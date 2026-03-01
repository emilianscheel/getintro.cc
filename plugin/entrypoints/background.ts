import type { Candidate, PipelineResult } from "../src/lib/types";
import {
    MESSAGE_TYPE,
    isRuntimeRequest,
    type RuntimeRequest,
    type RuntimeResponse,
} from "../src/lib/messages";
import { getOnboardingState, patchOnboardingState } from "../src/lib/state/storage";
import { saveEncryptedApiKey, loadApiKey, clearApiKey } from "../src/lib/security/secrets";
import { signInWithGoogle, signOutGoogle } from "../src/lib/auth/google";
import { crawlSite } from "../src/lib/crawl/crawler";
import {
    extractCandidatesWithMistral,
    generateCandidateEmailDraftsWithMistral,
    generateGenericMultiRecipientEmailDraftWithMistral,
    retrieveRegexEmailDisplayCandidatesWithMistral,
} from "../src/lib/integrations/mistral";
import { inferNameFromEmailAddress } from "../src/lib/extract/inferNameFromEmail";
import { enrichCandidatesWithEmailProviders } from "../src/lib/integrations/email-enrichment";
import { createDraftAndSend } from "../src/lib/integrations/gmail";
import { elapsedMs, logError, logInfo, previewText } from "../src/lib/logging";
import { defineBackground } from "wxt/utils/define-background";

const DEFAULT_COUNTDOWN_SECONDS = 5;
const MAX_DEPTH = 2 as const;
const MAX_PAGES = 25;
const MAX_ROCKETREACH_CANDIDATES = 8;
const DISABLE_GMAIL_SEND_FOR_TESTING = true;
type ActiveTab = chrome.tabs.Tab & { id: number; url: string };

const errorResponse = (error: string): RuntimeResponse => ({
    ok: false,
    type: MESSAGE_TYPE.PIPELINE_ERROR,
    error,
});

const summarizeRuntimeRequest = (message: RuntimeRequest): Record<string, unknown> => {
    switch (message.type) {
        case MESSAGE_TYPE.SAVE_API_KEY:
            return {
                type: message.type,
                provider: message.provider,
                keyLength: message.value.length,
            };
        case MESSAGE_TYPE.START_PIPELINE:
            return {
                type: message.type,
                countdownSeconds: message.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS,
            };
        case MESSAGE_TYPE.SUBMIT_EMAIL:
            return {
                type: message.type,
                payload: {
                    fromEmail: message.payload.fromEmail,
                    toEmail: message.payload.toEmail,
                    subject: message.payload.subject,
                    messageLength: message.payload.message.length,
                    messagePreview: previewText(message.payload.message, 200),
                },
            };
        default:
            return { type: message.type };
    }
};

const summarizeRuntimeResponse = (response: RuntimeResponse): Record<string, unknown> => {
    if (!response.ok) {
        return {
            ok: false,
            type: response.type,
            error: response.error,
        };
    }

    if (response.type === "STATE" || response.type === MESSAGE_TYPE.AUTH_STATUS_CHANGED) {
        return {
            ok: true,
            type: response.type,
            state: response.state,
        };
    }

    if (response.type === MESSAGE_TYPE.PIPELINE_RESULT) {
        return {
            ok: true,
            type: response.type,
            result: {
                domain: response.result.domain,
                partial: response.result.partial,
                stoppedAtMs: response.result.stoppedAtMs,
                visitedUrls: response.result.visitedUrls.length,
                regexEmails: response.result.emailsRegex.length,
                candidates: response.result.candidates.length,
            },
        };
    }

    return {
        ok: true,
        type: response.type,
        draftId: response.draftId,
        messageId: response.messageId,
    };
};

const isUnknownValue = (value: string | undefined): boolean => {
    if (!value) {
        return true;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length === 0 || normalized === "unknown" || normalized === "n/a";
};

const buildRegexDisplayCandidateByEmail = (candidates: Candidate[]): Map<string, Candidate> => {
    const byEmail = new Map<string, Candidate>();

    for (const candidate of candidates) {
        const email = candidate.email?.trim().toLowerCase();

        if (!email) {
            continue;
        }

        const existing = byEmail.get(email);

        if (!existing || candidate.score > existing.score) {
            byEmail.set(email, candidate);
        }
    }

    return byEmail;
};

const mergeRegexEmails = (
    candidates: Candidate[],
    regexEmails: string[],
    regexDisplayCandidates: Candidate[],
): Candidate[] => {
    const regexDisplayByEmail = buildRegexDisplayCandidateByEmail(regexDisplayCandidates);

    const enrichedExisting = candidates.map((candidate) => {
        const normalizedEmail = candidate.email?.trim().toLowerCase();

        if (!normalizedEmail) {
            return candidate;
        }

        const regexDisplayCandidate = regexDisplayByEmail.get(normalizedEmail);

        if (!regexDisplayCandidate) {
            return candidate;
        }

        const nextName = isUnknownValue(candidate.name)
            ? regexDisplayCandidate.name
            : candidate.name;
        const nextRole = isUnknownValue(candidate.role)
            ? regexDisplayCandidate.role
            : candidate.role;
        const nextScore = Math.max(candidate.score, regexDisplayCandidate.score);

        return {
            ...candidate,
            name: nextName,
            role: nextRole,
            score: nextScore,
        };
    });

    const merged = [...enrichedExisting];
    const knownEmails = new Set(
        merged
            .map((candidate) => candidate.email?.trim().toLowerCase())
            .filter((email): email is string => Boolean(email)),
    );

    for (const rawEmail of regexEmails) {
        const email = rawEmail.trim().toLowerCase();

        if (!email || knownEmails.has(email)) {
            continue;
        }

        const regexDisplayCandidate = regexDisplayByEmail.get(email);
        const inferredName = regexDisplayCandidate?.name || inferNameFromEmailAddress(email);
        const role = regexDisplayCandidate?.role?.trim() || "unknown";

        merged.push({
            name: inferredName || "Unknown",
            email,
            role,
            score: Math.max(0.25, regexDisplayCandidate?.score ?? 0),
            source: "regex",
        });
        knownEmails.add(email);
    }

    return merged.sort((a, b) => b.score - a.score);
};

const getActiveTab = async (): Promise<ActiveTab> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab?.id || !tab.url) {
        throw new Error("No active tab available.");
    }

    if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
        throw new Error("Only http(s) pages are supported.");
    }

    return tab as ActiveTab;
};

const startPipeline = async (countdownSeconds: number): Promise<RuntimeResponse> => {
    const pipelineStartedAt = Date.now();
    logInfo("pipeline", "starting pipeline", {
        countdownSeconds,
        hardTimeoutEnabled: false,
    });

    const onboarding = await getOnboardingState();
    logInfo("pipeline", "loaded onboarding state", onboarding);

    if (!onboarding.completed) {
        logInfo("pipeline", "pipeline blocked because onboarding is incomplete");
        return errorResponse("Please complete onboarding before running the pipeline.");
    }

    const mistralKey = await loadApiKey("mistral");
    const rocketreachKey = await loadApiKey("rocketreach");
    logInfo("pipeline", "loaded API keys", {
        mistralKeyPresent: Boolean(mistralKey),
        rocketreachKeyPresent: Boolean(rocketreachKey),
    });

    if (!mistralKey) {
        logInfo("pipeline", "pipeline blocked because Mistral API key is missing");
        return errorResponse("Missing Mistral API key. Open settings and add your key.");
    }

    const tab = await getActiveTab();
    const pageUrl = new URL(tab.url);
    logInfo("pipeline", "resolved active tab", {
        tabId: tab.id,
        tabUrl: tab.url,
        hostname: pageUrl.hostname,
    });

    const crawlStartedAt = Date.now();
    logInfo("pipeline:crawl", "crawl started", {
        startUrl: tab.url,
        maxDepth: MAX_DEPTH,
        maxPages: MAX_PAGES,
    });
    const crawl = await crawlSite({
        tabId: tab.id,
        startUrl: tab.url,
        maxDepth: MAX_DEPTH,
        maxPages: MAX_PAGES,
    });
    logInfo("pipeline:crawl", "crawl completed", {
        elapsedMs: elapsedMs(crawlStartedAt),
        pages: crawl.pages.length,
        visitedUrls: crawl.visitedUrls.length,
        regexEmails: crawl.emailsRegex.length,
        combinedTextChars: crawl.combinedText.length,
        partial: crawl.partial,
    });

    let candidates: Candidate[] = [];
    let regexDisplayCandidates: Candidate[] = [];
    let partial = crawl.partial;

    const hasMistralInput = crawl.combinedText.trim().length > 0 || crawl.emailsRegex.length > 0;

    if (hasMistralInput) {
        const mistralStartedAt = Date.now();
        logInfo("pipeline:mistral", "candidate extraction started", {
            domain: pageUrl.hostname,
            combinedTextChars: crawl.combinedText.length,
            regexEmails: crawl.emailsRegex.length,
        });

        const [candidateExtraction, regexDisplayExtraction] = await Promise.allSettled([
            extractCandidatesWithMistral(
                mistralKey,
                pageUrl.hostname,
                crawl.combinedText,
                crawl.emailsRegex,
            ),
            retrieveRegexEmailDisplayCandidatesWithMistral(
                mistralKey,
                pageUrl.hostname,
                crawl.emailsRegex,
            ),
        ]);

        if (candidateExtraction.status === "fulfilled") {
            candidates = candidateExtraction.value;
            logInfo("pipeline:mistral", "candidate extraction completed", {
                elapsedMs: elapsedMs(mistralStartedAt),
                candidates: candidates.length,
                preview: candidates.slice(0, 5),
            });
        } else {
            logError(
                "pipeline:mistral",
                "candidate extraction failed",
                candidateExtraction.reason,
            );
            partial = true;
        }

        if (regexDisplayExtraction.status === "fulfilled") {
            regexDisplayCandidates = regexDisplayExtraction.value;
            logInfo("pipeline:mistral", "regex display extraction completed", {
                elapsedMs: elapsedMs(mistralStartedAt),
                candidates: regexDisplayCandidates.length,
                preview: regexDisplayCandidates.slice(0, 5),
            });
        } else {
            logError(
                "pipeline:mistral",
                "regex display extraction failed",
                regexDisplayExtraction.reason,
            );
        }
    } else {
        logInfo("pipeline:mistral", "skipped candidate extraction because there was no crawl text or regex email input");
    }

    if (candidates.length > 0) {
        const enrichmentStartedAt = Date.now();
        logInfo("pipeline:enrichment", "email enrichment started", {
            domain: pageUrl.hostname,
            candidates: candidates.length,
            maxCandidates: MAX_ROCKETREACH_CANDIDATES,
        });

        try {
            candidates = await enrichCandidatesWithEmailProviders({
                domain: pageUrl.hostname,
                candidates,
                maxCandidates: MAX_ROCKETREACH_CANDIDATES,
                apiKeys: {
                    rocketreach: rocketreachKey,
                },
            });
            logInfo("pipeline:enrichment", "email enrichment completed", {
                elapsedMs: elapsedMs(enrichmentStartedAt),
                candidates: candidates.length,
                candidatesWithEmail: candidates.filter((candidate) => Boolean(candidate.email))
                    .length,
            });
        } catch (error) {
            logError("pipeline:enrichment", "email enrichment failed", error);
            partial = true;
        }
    } else {
        logInfo("pipeline:enrichment", "skipped email enrichment because there were no candidates");
    }

    const mergedCandidates = mergeRegexEmails(candidates, crawl.emailsRegex, regexDisplayCandidates);
    let candidatesWithDrafts = mergedCandidates;
    let multiRecipientDraft: string | undefined;

    if (mergedCandidates.length > 0) {
        try {
            const draftStartedAt = Date.now();
            const drafts = await generateCandidateEmailDraftsWithMistral(
                mistralKey,
                pageUrl.hostname,
                crawl.combinedText,
                mergedCandidates,
            );

            candidatesWithDrafts = mergedCandidates.map((candidate, index) => ({
                ...candidate,
                draft: drafts[index]?.trim() || undefined,
            }));

            logInfo("pipeline:mistral", "candidate draft generation completed", {
                elapsedMs: elapsedMs(draftStartedAt),
                candidates: mergedCandidates.length,
                draftsGenerated: drafts.filter((draft) => Boolean(draft?.trim())).length,
            });
        } catch (error) {
            logError("pipeline:mistral", "candidate draft generation failed", error);
        }
    }

    if (candidatesWithDrafts.length > 1) {
        try {
            const genericDraftStartedAt = Date.now();
            multiRecipientDraft = await generateGenericMultiRecipientEmailDraftWithMistral(
                mistralKey,
                pageUrl.hostname,
                crawl.combinedText,
                candidatesWithDrafts,
            );
            logInfo("pipeline:mistral", "generic multi-recipient draft generation completed", {
                elapsedMs: elapsedMs(genericDraftStartedAt),
                recipients: candidatesWithDrafts.length,
                hasDraft: Boolean(multiRecipientDraft),
            });
        } catch (error) {
            logError("pipeline:mistral", "generic multi-recipient draft generation failed", error);
        }
    }

    const result: PipelineResult = {
        domain: pageUrl.hostname,
        visitedUrls: crawl.visitedUrls,
        emailsRegex: crawl.emailsRegex,
        candidates: candidatesWithDrafts,
        multiRecipientDraft,
        partial,
        stoppedAtMs: elapsedMs(pipelineStartedAt),
    };
    logInfo("pipeline", "pipeline completed", {
        elapsedMs: elapsedMs(pipelineStartedAt),
        partial: result.partial,
        stoppedAtMs: result.stoppedAtMs,
        visitedUrls: result.visitedUrls.length,
        regexEmails: result.emailsRegex.length,
        candidates: result.candidates.length,
        candidatesWithEmail: result.candidates.filter((candidate) => Boolean(candidate.email))
            .length,
    });

    return {
        ok: true,
        type: MESSAGE_TYPE.PIPELINE_RESULT,
        result,
    };
};

const handleMessage = async (message: RuntimeRequest): Promise<RuntimeResponse> => {
    switch (message.type) {
        case MESSAGE_TYPE.GET_STATE: {
            const state = await getOnboardingState();
            return {
                ok: true,
                type: "STATE",
                state,
            };
        }

        case MESSAGE_TYPE.MARK_STARTED: {
            const state = await patchOnboardingState({ started: true });
            return {
                ok: true,
                type: MESSAGE_TYPE.AUTH_STATUS_CHANGED,
                state,
            };
        }

        case MESSAGE_TYPE.START_GOOGLE_AUTH: {
            const { email } = await signInWithGoogle();
            const state = await patchOnboardingState({
                started: true,
                googleConnected: true,
                googleEmail: email,
            });

            return {
                ok: true,
                type: MESSAGE_TYPE.AUTH_STATUS_CHANGED,
                state,
            };
        }

        case MESSAGE_TYPE.DISCONNECT_GOOGLE: {
            await signOutGoogle();
            const state = await patchOnboardingState({
                googleConnected: false,
                googleEmail: undefined,
            });

            return {
                ok: true,
                type: MESSAGE_TYPE.AUTH_STATUS_CHANGED,
                state,
            };
        }

        case MESSAGE_TYPE.SAVE_API_KEY: {
            if (!message.value.trim()) {
                return errorResponse("API key cannot be empty.");
            }

            await saveEncryptedApiKey(message.provider, message.value.trim());

            const state = await patchOnboardingState({
                started: true,
                ...(message.provider === "mistral"
                    ? { mistralKeySet: true }
                    : { rocketreachKeySet: true }),
            });

            return {
                ok: true,
                type: MESSAGE_TYPE.AUTH_STATUS_CHANGED,
                state,
            };
        }

        case MESSAGE_TYPE.START_PIPELINE: {
            const countdownSeconds = message.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;
            return startPipeline(countdownSeconds);
        }

        case MESSAGE_TYPE.SUBMIT_EMAIL: {
            if (DISABLE_GMAIL_SEND_FOR_TESTING) {
                logInfo("gmail", "submit email skipped because testing mode is enabled");
                return errorResponse(
                    "Gmail sending is disabled for testing. Google login is still enabled.",
                );
            }

            logInfo("gmail", "submitting outbound email", {
                fromEmail: message.payload.fromEmail,
                toEmail: message.payload.toEmail,
                subject: message.payload.subject,
                messageLength: message.payload.message.length,
                messagePreview: previewText(message.payload.message, 200),
            });
            const sent = await createDraftAndSend(message.payload);
            logInfo("gmail", "gmail send completed", sent);

            return {
                ok: true,
                type: MESSAGE_TYPE.EMAIL_SENT,
                draftId: sent.draftId,
                messageId: sent.messageId,
            };
        }

        default:
            return errorResponse("Unknown message type.");
    }
};

export default defineBackground(() => {
    logInfo("lifecycle", "background worker initialized");

    chrome.runtime.onMessage.addListener((incoming, _sender, sendResponse) => {
        if (!isRuntimeRequest(incoming)) {
            logError("runtime", "received unknown message", incoming);
            sendResponse(errorResponse("Unknown message type."));
            return false;
        }

        void (async () => {
            try {
                logInfo("runtime", "received request", summarizeRuntimeRequest(incoming));
                const response = await handleMessage(incoming);
                logInfo("runtime", "sending response", summarizeRuntimeResponse(response));
                sendResponse(response);
            } catch (error) {
                logError("runtime", "failed to handle request", {
                    request: summarizeRuntimeRequest(incoming),
                    error,
                });
                sendResponse(
                    errorResponse(
                        error instanceof Error ? error.message : "Unexpected background error",
                    ),
                );
            }
        })();

        return true;
    });

    chrome.runtime.onInstalled.addListener((details) => {
        logInfo("lifecycle", "onInstalled fired", { reason: details.reason });

        if (details.reason !== "install") {
            return;
        }

        logInfo("lifecycle", "clearing onboarding state and API keys for fresh install");
        void patchOnboardingState({ started: false });
        void clearApiKey("mistral");
        void clearApiKey("rocketreach");
    });
});
