import type { Candidate, PipelineResult } from "../src/lib/types";
import {
  MESSAGE_TYPE,
  isRuntimeRequest,
  type RuntimeRequest,
  type RuntimeResponse
} from "../src/lib/messages";
import {
  getOnboardingState,
  patchOnboardingState
} from "../src/lib/state/storage";
import {
  saveEncryptedApiKey,
  loadApiKey,
  clearApiKey
} from "../src/lib/security/secrets";
import { signInWithGoogle, signOutGoogle } from "../src/lib/auth/google";
import { crawlSite } from "../src/lib/crawl/crawler";
import { extractCandidatesWithMistral } from "../src/lib/integrations/mistral";
import { enrichCandidatesWithRocketReach } from "../src/lib/integrations/rocketreach";
import { createDraftAndSend } from "../src/lib/integrations/gmail";
import { defineBackground } from "wxt/utils/define-background";

const DEFAULT_COUNTDOWN_SECONDS = 5;
const MAX_DEPTH = 2 as const;
const MAX_PAGES = 25;
const MAX_ROCKETREACH_CANDIDATES = 8;
type ActiveTab = chrome.tabs.Tab & { id: number; url: string };

const errorResponse = (error: string): RuntimeResponse => ({
  ok: false,
  type: MESSAGE_TYPE.PIPELINE_ERROR,
  error
});

const formatNameFromEmail = (email: string): string => {
  const localPart = email.split("@")[0] ?? "";

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Unknown";
};

const mergeRegexEmails = (
  candidates: Candidate[],
  regexEmails: string[]
): Candidate[] => {
  const merged = [...candidates];
  const knownEmails = new Set(
    candidates
      .map((candidate) => candidate.email?.toLowerCase())
      .filter((email): email is string => Boolean(email))
  );

  for (const email of regexEmails) {
    if (knownEmails.has(email)) {
      continue;
    }

    merged.push({
      name: formatNameFromEmail(email),
      email,
      role: "unknown",
      score: 0.25,
      source: "regex"
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

const withAbortDeadline = async <T>(
  deadlineAt: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const remaining = deadlineAt - Date.now();

  if (remaining <= 0) {
    throw new Error("Pipeline deadline reached.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remaining);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const startPipeline = async (
  countdownSeconds: number
): Promise<RuntimeResponse> => {
  const onboarding = await getOnboardingState();

  if (!onboarding.completed) {
    return errorResponse("Please complete onboarding before running the pipeline.");
  }

  const mistralKey = await loadApiKey("mistral");
  const rocketreachKey = await loadApiKey("rocketreach");

  if (!mistralKey || !rocketreachKey) {
    return errorResponse(
      "Missing encrypted API keys. Open settings and re-enter your keys."
    );
  }

  const tab = await getActiveTab();
  const pageUrl = new URL(tab.url);
  const deadlineAt = Date.now() + countdownSeconds * 1000;

  const crawl = await crawlSite({
    tabId: tab.id,
    startUrl: tab.url,
    maxDepth: MAX_DEPTH,
    maxPages: MAX_PAGES,
    deadlineAt
  });

  let candidates: Candidate[] = [];
  let partial = crawl.partial || Date.now() >= deadlineAt;

  if (!partial && crawl.combinedText.trim()) {
    try {
      candidates = await withAbortDeadline(deadlineAt, (signal) =>
        extractCandidatesWithMistral(
          mistralKey,
          pageUrl.hostname,
          crawl.combinedText,
          signal
        )
      );
    } catch {
      partial = true;
    }
  }

  if (!partial && candidates.length > 0) {
    try {
      candidates = await enrichCandidatesWithRocketReach({
        apiKey: rocketreachKey,
        domain: pageUrl.hostname,
        candidates,
        maxCandidates: MAX_ROCKETREACH_CANDIDATES,
        deadlineAt
      });
    } catch {
      partial = true;
    }
  }

  partial = partial || Date.now() >= deadlineAt;

  const result: PipelineResult = {
    domain: pageUrl.hostname,
    visitedUrls: crawl.visitedUrls,
    emailsRegex: crawl.emailsRegex,
    candidates: mergeRegexEmails(candidates, crawl.emailsRegex),
    partial,
    stoppedAtMs: countdownSeconds * 1000 - Math.max(0, deadlineAt - Date.now())
  };

  return {
    ok: true,
    type: MESSAGE_TYPE.PIPELINE_RESULT,
    result
  };
};

const handleMessage = async (message: RuntimeRequest): Promise<RuntimeResponse> => {
  switch (message.type) {
    case MESSAGE_TYPE.GET_STATE: {
      const state = await getOnboardingState();
      return {
        ok: true,
        type: "STATE",
        state
      };
    }

    case MESSAGE_TYPE.MARK_STARTED: {
      const state = await patchOnboardingState({ started: true });
      return {
        ok: true,
        type: MESSAGE_TYPE.AUTH_STATUS_CHANGED,
        state
      };
    }

    case MESSAGE_TYPE.START_GOOGLE_AUTH: {
      const { email } = await signInWithGoogle();
      const state = await patchOnboardingState({
        started: true,
        googleConnected: true,
        googleEmail: email
      });

      return {
        ok: true,
        type: MESSAGE_TYPE.AUTH_STATUS_CHANGED,
        state
      };
    }

    case MESSAGE_TYPE.DISCONNECT_GOOGLE: {
      await signOutGoogle();
      const state = await patchOnboardingState({
        googleConnected: false,
        googleEmail: undefined
      });

      return {
        ok: true,
        type: MESSAGE_TYPE.AUTH_STATUS_CHANGED,
        state
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
          : { rocketreachKeySet: true })
      });

      return {
        ok: true,
        type: MESSAGE_TYPE.AUTH_STATUS_CHANGED,
        state
      };
    }

    case MESSAGE_TYPE.START_PIPELINE: {
      const countdownSeconds =
        message.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;
      return startPipeline(countdownSeconds);
    }

    case MESSAGE_TYPE.SUBMIT_EMAIL: {
      console.log("[getintro.cc][debug] outbound email payload", message.payload);
      const sent = await createDraftAndSend(message.payload);

      return {
        ok: true,
        type: MESSAGE_TYPE.EMAIL_SENT,
        draftId: sent.draftId,
        messageId: sent.messageId
      };
    }

    default:
      return errorResponse("Unknown message type.");
  }
};

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((incoming, _sender, sendResponse) => {
    if (!isRuntimeRequest(incoming)) {
      sendResponse(errorResponse("Unknown message type."));
      return false;
    }

    void (async () => {
      try {
        const response = await handleMessage(incoming);
        sendResponse(response);
      } catch (error) {
        sendResponse(
          errorResponse(
            error instanceof Error ? error.message : "Unexpected background error"
          )
        );
      }
    })();

    return true;
  });

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason !== "install") {
      return;
    }

    void patchOnboardingState({ started: false });
    void clearApiKey("mistral");
    void clearApiKey("rocketreach");
  });
});
