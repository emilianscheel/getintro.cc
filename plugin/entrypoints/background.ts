import type {
    CachedDomainPipelinePool,
    Candidate,
    DraftAndSendRequest,
    OutreachRecord,
    PipelineResult,
    PipelineRunMode,
} from "../src/lib/types";
import {
    MESSAGE_TYPE,
    isRuntimeRequest,
    type RuntimeRequest,
    type RuntimeResponse,
} from "../src/lib/messages";
import {
    clearAllPipelinePools,
    appendOutreachRecord,
    clearPipelinePool,
    getPipelineCacheEpoch,
    getOnboardingState,
    getOutreachHistory,
    getPipelinePool,
    patchOnboardingState,
    setOutreachHistory,
    setPipelinePool,
} from "../src/lib/state/storage";
import { mergePipelineResultIntoPool } from "../src/lib/state/pipelinePool";
import {
    getHttpHostnameFromUrl,
    shouldPersistPipelinePoolForEpoch,
} from "../src/lib/state/pipelineCacheControl";
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
import { buildRegexEmailDisplayContexts } from "../src/lib/extract/regexEmailContext";
import { enrichCandidatesWithEmailProviders } from "../src/lib/integrations/email-enrichment";
import {
    buildGmailMessageUrl,
    createDraftAndSend,
    createDraftOnly,
    getDraftById,
    type GmailSubmissionResult,
} from "../src/lib/integrations/gmail";
import { elapsedMs, logError, logInfo, previewText } from "../src/lib/logging";
import { defineBackground } from "wxt/utils/define-background";

const DEFAULT_COUNTDOWN_SECONDS = 5;
const MAX_DEPTH = 2 as const;
const MAX_PAGES = 25;
const MAX_ROCKETREACH_CANDIDATES = 8;
const DISABLE_GMAIL_SEND_FOR_TESTING = __DISABLE_GMAIL_SEND_FOR_TESTING__;
const pipelineRefreshInFlight = new Set<string>();
type ActiveTab = chrome.tabs.Tab & { id: number; url: string };

const errorResponse = (error: string): RuntimeResponse => ({
    ok: false,
    type: MESSAGE_TYPE.PIPELINE_ERROR,
    error,
});

const summarizeRuntimeRequest = (message: RuntimeRequest): Record<string, unknown> => {
    switch (message.type) {
        case MESSAGE_TYPE.GET_ACTIVE_TAB_CACHE_STATUS:
            return {
                type: message.type,
            };
        case MESSAGE_TYPE.SAVE_API_KEY:
            return {
                type: message.type,
                provider: message.provider,
                keyLength: message.value.length,
            };
        case MESSAGE_TYPE.SAVE_CUSTOM_DRAFT_PROMPT:
            return {
                type: message.type,
                promptLength: message.value.length,
            };
        case MESSAGE_TYPE.CLEAR_PIPELINE_CACHE:
            return {
                type: message.type,
                scope: message.scope,
                domain: message.scope === "domain" ? message.domain : undefined,
            };
        case MESSAGE_TYPE.START_PIPELINE:
            return {
                type: message.type,
                countdownSeconds: message.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS,
                mode: message.mode ?? "cache_then_refresh",
            };
        case MESSAGE_TYPE.SUBMIT_EMAIL:
        case MESSAGE_TYPE.SAVE_EMAIL_DRAFT:
            return {
                type: message.type,
                payload: {
                    fromEmail: message.payload.fromEmail,
                    toEmail: message.payload.toEmail,
                    bccEmails: message.payload.bccEmails,
                    subject: message.payload.subject,
                    messageLength: message.payload.message.length,
                    messagePreview: previewText(message.payload.message, 200),
                    hostname: message.payload.hostname,
                },
            };
        case MESSAGE_TYPE.GET_PAST_OUTREACHES:
            return {
                type: message.type,
                syncDraftStatuses: Boolean(message.syncDraftStatuses),
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

    if (response.type === MESSAGE_TYPE.ACTIVE_TAB_CACHE_STATUS) {
        return {
            ok: true,
            type: response.type,
            hostname: response.hostname,
            hasCache: response.hasCache,
        };
    }

    if (response.type === MESSAGE_TYPE.PIPELINE_CACHE_CLEARED) {
        return {
            ok: true,
            type: response.type,
            scope: response.scope,
            domain: response.domain,
        };
    }

    if (response.type === MESSAGE_TYPE.PAST_OUTREACHES) {
        return {
            ok: true,
            type: response.type,
            items: response.items.length,
        };
    }

    return {
        ok: true,
        type: response.type,
        draftId: response.draftId,
        messageId: response.messageId,
        gmailUrl: response.gmailUrl,
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

const getActiveTabCacheStatus = async (): Promise<{
    hostname?: string;
    hasCache: boolean;
}> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const hostname = getHttpHostnameFromUrl(tab?.url);

    if (!hostname) {
        return { hasCache: false };
    }

    const pool = await getPipelinePool(hostname);
    return {
        hostname,
        hasCache: Boolean(pool),
    };
};

const resolveOutboundHostname = async (preferredHostname?: string): Promise<string> => {
    const trimmed = preferredHostname?.trim().toLowerCase();

    if (trimmed) {
        return trimmed;
    }

    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const hostname = getHttpHostnameFromUrl(tabs[0]?.url);

        if (hostname) {
            return hostname;
        }
    } catch (error) {
        logError("gmail", "failed to resolve active tab hostname for outreach history", error);
    }

    return "unknown";
};

const buildOutreachRecord = (
    payload: DraftAndSendRequest,
    mode: "sent" | "draft",
    hostname: string,
    submission: GmailSubmissionResult,
): OutreachRecord => {
    return {
        id: crypto.randomUUID(),
        createdAtMs: Date.now(),
        status: mode,
        hostname,
        toEmail: payload.toEmail,
        bccEmails: payload.bccEmails ?? [],
        recipientEmail: payload.toEmail,
        senderEmail: payload.fromEmail,
        subject: payload.subject,
        body: payload.message,
        gmailUrl: submission.gmailUrl,
        gmailDraftId: submission.draftId,
        gmailMessageId: submission.messageId || undefined,
        gmailThreadId: submission.threadId,
    };
};

const submitOutboundEmail = async (
    payload: DraftAndSendRequest,
    mode: "sent" | "draft",
): Promise<GmailSubmissionResult> => {
    const result =
        mode === "sent" ? await createDraftAndSend(payload) : await createDraftOnly(payload);
    const hostname = await resolveOutboundHostname(payload.hostname);
    const outreach = buildOutreachRecord(payload, mode, hostname, result);
    await appendOutreachRecord(outreach);
    return result;
};

const reconcileDraftOutreachStatuses = async (
    history: OutreachRecord[],
): Promise<{ items: OutreachRecord[]; changed: boolean }> => {
    if (history.length === 0) {
        return { items: history, changed: false };
    }

    let changed = false;
    const reconciled: OutreachRecord[] = [];

    for (const item of history) {
        if (item.status !== "draft" || !item.gmailDraftId) {
            reconciled.push(item);
            continue;
        }

        let draft: Awaited<ReturnType<typeof getDraftById>>;

        try {
            draft = await getDraftById(item.gmailDraftId);
        } catch (error) {
            logError("gmail", "failed to reconcile draft status", {
                draftId: item.gmailDraftId,
                error,
            });
            reconciled.push(item);
            continue;
        }

        if (draft) {
            reconciled.push(item);
            continue;
        }

        changed = true;
        const gmailUrl = buildGmailMessageUrl({
            id: item.gmailMessageId,
            threadId: item.gmailThreadId,
        });
        reconciled.push({
            ...item,
            status: "sent",
            gmailUrl,
            gmailDraftId: undefined,
        });
    }

    return { items: reconciled, changed };
};

const poolToPipelineResult = (
    pool: CachedDomainPipelinePool,
    overrides?: Partial<PipelineResult>,
): PipelineResult => {
    return {
        domain: pool.domain,
        visitedUrls: pool.visitedUrls,
        emailsRegex: pool.emailsRegex,
        candidates: pool.candidates,
        multiRecipientDraftSubject: pool.multiRecipientDraftSubject,
        multiRecipientDraft: pool.multiRecipientDraft,
        partial: false,
        stoppedAtMs: 0,
        ...overrides,
    };
};

type RunFreshPipelineInput = {
    countdownSeconds: number;
    tab: ActiveTab;
    pageUrl: URL;
    onboarding: Awaited<ReturnType<typeof getOnboardingState>>;
    mistralKey: string;
    rocketreachKey: string | null;
};

const runFreshPipelineForDomain = async ({
    countdownSeconds,
    tab,
    pageUrl,
    onboarding,
    mistralKey,
    rocketreachKey,
}: RunFreshPipelineInput): Promise<PipelineResult> => {
    const pipelineStartedAt = Date.now();
    logInfo("pipeline:fresh", "starting fresh pipeline", {
        countdownSeconds,
        hardTimeoutEnabled: false,
        domain: pageUrl.hostname,
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
    const regexEmailContexts = buildRegexEmailDisplayContexts(crawl.pages, crawl.emailsRegex);

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
                regexEmailContexts,
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
            logError("pipeline:mistral", "candidate extraction failed", candidateExtraction.reason);
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
        logInfo(
            "pipeline:mistral",
            "skipped candidate extraction because there was no crawl text or regex email input",
        );
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

    const mergedCandidates = mergeRegexEmails(
        candidates,
        crawl.emailsRegex,
        regexDisplayCandidates,
    );
    let candidatesWithDrafts = mergedCandidates;
    let multiRecipientDraftSubject: string | undefined;
    let multiRecipientDraft: string | undefined;

    if (mergedCandidates.length > 0) {
        try {
            const draftStartedAt = Date.now();
            const drafts = await generateCandidateEmailDraftsWithMistral(
                mistralKey,
                pageUrl.hostname,
                crawl.combinedText,
                mergedCandidates,
                onboarding.googleName,
                onboarding.googleEmail,
                onboarding.customDraftPrompt,
            );

            candidatesWithDrafts = mergedCandidates.map((candidate, index) => ({
                ...candidate,
                draftSubject: drafts[index]?.subject.trim() || undefined,
                draft: drafts[index]?.message.trim() || undefined,
            }));

            logInfo("pipeline:mistral", "candidate draft generation completed", {
                elapsedMs: elapsedMs(draftStartedAt),
                candidates: mergedCandidates.length,
                draftsGenerated: drafts.filter((draft) => Boolean(draft?.message.trim())).length,
            });
        } catch (error) {
            logError("pipeline:mistral", "candidate draft generation failed", error);
        }
    }

    if (candidatesWithDrafts.length > 1) {
        try {
            const genericDraftStartedAt = Date.now();
            const genericDraft = await generateGenericMultiRecipientEmailDraftWithMistral(
                mistralKey,
                pageUrl.hostname,
                crawl.combinedText,
                candidatesWithDrafts,
                onboarding.googleName,
                onboarding.googleEmail,
                onboarding.customDraftPrompt,
            );
            multiRecipientDraftSubject = genericDraft?.subject.trim() || undefined;
            multiRecipientDraft = genericDraft?.message.trim() || undefined;
            logInfo("pipeline:mistral", "generic multi-recipient draft generation completed", {
                elapsedMs: elapsedMs(genericDraftStartedAt),
                recipients: candidatesWithDrafts.length,
                hasDraft: Boolean(multiRecipientDraft?.trim()),
                hasSubject: Boolean(multiRecipientDraftSubject?.trim()),
            });
        } catch (error) {
            logError("pipeline:mistral", "generic multi-recipient draft generation failed", error);
        }
    }

    return {
        domain: pageUrl.hostname,
        visitedUrls: crawl.visitedUrls,
        emailsRegex: crawl.emailsRegex,
        candidates: candidatesWithDrafts,
        multiRecipientDraftSubject,
        multiRecipientDraft,
        partial,
        stoppedAtMs: elapsedMs(pipelineStartedAt),
    };
};

const startPipeline = async (
    countdownSeconds: number,
    mode: PipelineRunMode,
): Promise<RuntimeResponse> => {
    const runEpoch = await getPipelineCacheEpoch();
    logInfo("pipeline", "starting pipeline", {
        countdownSeconds,
        hardTimeoutEnabled: false,
        mode,
        runEpoch,
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
    const domain = pageUrl.hostname;
    logInfo("pipeline", "resolved active tab", {
        tabId: tab.id,
        tabUrl: tab.url,
        hostname: domain,
    });

    if (mode === "cache_then_refresh") {
        const cachedPool = await getPipelinePool(domain);

        if (cachedPool) {
            const refreshRunning = pipelineRefreshInFlight.has(domain);

            if (!refreshRunning) {
                pipelineRefreshInFlight.add(domain);
                void (async () => {
                    try {
                        const freshResult = await runFreshPipelineForDomain({
                            countdownSeconds,
                            tab,
                            pageUrl,
                            onboarding,
                            mistralKey,
                            rocketreachKey,
                        });
                        const currentEpoch = await getPipelineCacheEpoch();

                        if (!shouldPersistPipelinePoolForEpoch(runEpoch, currentEpoch)) {
                            logInfo("pipeline:cache", "skipping stale background refresh write", {
                                domain,
                                runEpoch,
                                currentEpoch,
                            });
                            return;
                        }

                        const latestPool = await getPipelinePool(domain);
                        const mergedPool = mergePipelineResultIntoPool(latestPool, freshResult);
                        await setPipelinePool(domain, mergedPool);
                        logInfo("pipeline:cache", "background refresh completed", {
                            domain,
                            candidates: mergedPool.candidates.length,
                            visitedUrls: mergedPool.visitedUrls.length,
                            regexEmails: mergedPool.emailsRegex.length,
                        });
                    } catch (error) {
                        logError("pipeline:cache", "background refresh failed", {
                            domain,
                            error,
                        });
                    } finally {
                        pipelineRefreshInFlight.delete(domain);
                    }
                })();
            }

            const cachedResult = poolToPipelineResult(cachedPool, {
                servedFromCache: true,
                backgroundRefreshStarted: true,
            });

            logInfo("pipeline:cache", "served cached result", {
                domain,
                candidates: cachedResult.candidates.length,
                visitedUrls: cachedResult.visitedUrls.length,
                regexEmails: cachedResult.emailsRegex.length,
            });

            return {
                ok: true,
                type: MESSAGE_TYPE.PIPELINE_RESULT,
                result: cachedResult,
            };
        }
    }

    const freshResult = await runFreshPipelineForDomain({
        countdownSeconds,
        tab,
        pageUrl,
        onboarding,
        mistralKey,
        rocketreachKey,
    });
    const currentEpoch = await getPipelineCacheEpoch();

    if (!shouldPersistPipelinePoolForEpoch(runEpoch, currentEpoch)) {
        logInfo("pipeline", "skipping stale fresh pipeline cache write", {
            domain,
            runEpoch,
            currentEpoch,
        });

        return {
            ok: true,
            type: MESSAGE_TYPE.PIPELINE_RESULT,
            result: {
                ...freshResult,
                servedFromCache: false,
                backgroundRefreshStarted: false,
            },
        };
    }

    const existingPool = await getPipelinePool(domain);
    const mergedPool = mergePipelineResultIntoPool(existingPool, freshResult);
    await setPipelinePool(domain, mergedPool);
    const result = poolToPipelineResult(mergedPool, {
        partial: freshResult.partial,
        stoppedAtMs: freshResult.stoppedAtMs,
        servedFromCache: false,
        backgroundRefreshStarted: false,
    });

    logInfo("pipeline", "pipeline completed", {
        elapsedMs: result.stoppedAtMs,
        partial: result.partial,
        stoppedAtMs: result.stoppedAtMs,
        visitedUrls: result.visitedUrls.length,
        regexEmails: result.emailsRegex.length,
        candidates: result.candidates.length,
        candidatesWithEmail: result.candidates.filter((candidate) => Boolean(candidate.email))
            .length,
        mode,
    });

    return {
        ok: true,
        type: MESSAGE_TYPE.PIPELINE_RESULT,
        result: result,
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

        case MESSAGE_TYPE.GET_ACTIVE_TAB_CACHE_STATUS: {
            try {
                const status = await getActiveTabCacheStatus();
                return {
                    ok: true,
                    type: MESSAGE_TYPE.ACTIVE_TAB_CACHE_STATUS,
                    hostname: status.hostname,
                    hasCache: status.hasCache,
                };
            } catch (error) {
                logError("pipeline:cache", "failed to get active tab cache status", error);
                return {
                    ok: true,
                    type: MESSAGE_TYPE.ACTIVE_TAB_CACHE_STATUS,
                    hasCache: false,
                };
            }
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
            const { email, name } = await signInWithGoogle();
            const state = await patchOnboardingState({
                started: true,
                googleConnected: true,
                googleEmail: email,
                googleName: name,
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
                googleName: undefined,
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

        case MESSAGE_TYPE.SAVE_CUSTOM_DRAFT_PROMPT: {
            const state = await patchOnboardingState({
                started: true,
                customDraftPrompt: message.value,
            });

            return {
                ok: true,
                type: MESSAGE_TYPE.AUTH_STATUS_CHANGED,
                state,
            };
        }

        case MESSAGE_TYPE.CLEAR_PIPELINE_CACHE: {
            if (message.scope === "all") {
                const epoch = await clearAllPipelinePools();
                pipelineRefreshInFlight.clear();
                logInfo("pipeline:cache", "cleared all pipeline pools", { epoch });
                return {
                    ok: true,
                    type: MESSAGE_TYPE.PIPELINE_CACHE_CLEARED,
                    scope: "all",
                };
            }

            await clearPipelinePool(message.domain);
            pipelineRefreshInFlight.delete(message.domain);
            logInfo("pipeline:cache", "cleared pipeline pool for domain", {
                domain: message.domain,
            });
            return {
                ok: true,
                type: MESSAGE_TYPE.PIPELINE_CACHE_CLEARED,
                scope: "domain",
                domain: message.domain,
            };
        }

        case MESSAGE_TYPE.START_PIPELINE: {
            const countdownSeconds = message.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;
            const mode = message.mode ?? "cache_then_refresh";
            return startPipeline(countdownSeconds, mode);
        }

        case MESSAGE_TYPE.GET_PAST_OUTREACHES: {
            const items = await getOutreachHistory();
            const shouldSync = Boolean(message.syncDraftStatuses);

            if (!shouldSync) {
                return {
                    ok: true,
                    type: MESSAGE_TYPE.PAST_OUTREACHES,
                    items,
                };
            }

            const reconciled = await reconcileDraftOutreachStatuses(items);

            if (reconciled.changed) {
                await setOutreachHistory(reconciled.items);
            }

            return {
                ok: true,
                type: MESSAGE_TYPE.PAST_OUTREACHES,
                items: reconciled.items,
            };
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
                bccEmails: message.payload.bccEmails,
                subject: message.payload.subject,
                messageLength: message.payload.message.length,
                messagePreview: previewText(message.payload.message, 200),
            });
            const sent = await submitOutboundEmail(message.payload, "sent");
            logInfo("gmail", "gmail send completed", sent);

            return {
                ok: true,
                type: MESSAGE_TYPE.EMAIL_SENT,
                draftId: sent.draftId,
                messageId: sent.messageId,
                gmailUrl: sent.gmailUrl,
            };
        }

        case MESSAGE_TYPE.SAVE_EMAIL_DRAFT: {
            if (DISABLE_GMAIL_SEND_FOR_TESTING) {
                logInfo("gmail", "save draft skipped because testing mode is enabled");
                return errorResponse(
                    "Gmail sending is disabled for testing. Google login is still enabled.",
                );
            }

            logInfo("gmail", "saving outbound email as draft", {
                fromEmail: message.payload.fromEmail,
                toEmail: message.payload.toEmail,
                bccEmails: message.payload.bccEmails,
                subject: message.payload.subject,
                messageLength: message.payload.message.length,
                messagePreview: previewText(message.payload.message, 200),
            });
            const draft = await submitOutboundEmail(message.payload, "draft");
            logInfo("gmail", "gmail draft saved", draft);

            return {
                ok: true,
                type: MESSAGE_TYPE.EMAIL_DRAFT_SAVED,
                draftId: draft.draftId,
                messageId: draft.messageId,
                gmailUrl: draft.gmailUrl,
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
