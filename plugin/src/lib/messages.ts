import type {
  ApiProvider,
  DraftAndSendRequest,
  OutreachRecord,
  PipelineRunMode,
  OnboardingState,
  PipelineResult
} from "./types";

export const MESSAGE_TYPE = {
  GET_STATE: "GET_STATE",
  GET_ACTIVE_TAB_CACHE_STATUS: "GET_ACTIVE_TAB_CACHE_STATUS",
  MARK_STARTED: "MARK_STARTED",
  START_GOOGLE_AUTH: "START_GOOGLE_AUTH",
  DISCONNECT_GOOGLE: "DISCONNECT_GOOGLE",
  SAVE_API_KEY: "SAVE_API_KEY",
  SAVE_CUSTOM_DRAFT_PROMPT: "SAVE_CUSTOM_DRAFT_PROMPT",
  CLEAR_PIPELINE_CACHE: "CLEAR_PIPELINE_CACHE",
  START_PIPELINE: "START_PIPELINE",
  SUBMIT_EMAIL: "SUBMIT_EMAIL",
  SAVE_EMAIL_DRAFT: "SAVE_EMAIL_DRAFT",
  GET_PAST_OUTREACHES: "GET_PAST_OUTREACHES",
  AUTH_STATUS_CHANGED: "AUTH_STATUS_CHANGED",
  PIPELINE_RESULT: "PIPELINE_RESULT",
  ACTIVE_TAB_CACHE_STATUS: "ACTIVE_TAB_CACHE_STATUS",
  PIPELINE_CACHE_CLEARED: "PIPELINE_CACHE_CLEARED",
  PIPELINE_ERROR: "PIPELINE_ERROR",
  EMAIL_SENT: "EMAIL_SENT",
  EMAIL_DRAFT_SAVED: "EMAIL_DRAFT_SAVED",
  PAST_OUTREACHES: "PAST_OUTREACHES"
} as const;

const REQUEST_MESSAGE_TYPES = [
  MESSAGE_TYPE.GET_STATE,
  MESSAGE_TYPE.GET_ACTIVE_TAB_CACHE_STATUS,
  MESSAGE_TYPE.MARK_STARTED,
  MESSAGE_TYPE.START_GOOGLE_AUTH,
  MESSAGE_TYPE.DISCONNECT_GOOGLE,
  MESSAGE_TYPE.SAVE_API_KEY,
  MESSAGE_TYPE.SAVE_CUSTOM_DRAFT_PROMPT,
  MESSAGE_TYPE.CLEAR_PIPELINE_CACHE,
  MESSAGE_TYPE.START_PIPELINE,
  MESSAGE_TYPE.SUBMIT_EMAIL,
  MESSAGE_TYPE.SAVE_EMAIL_DRAFT,
  MESSAGE_TYPE.GET_PAST_OUTREACHES
] as const;

export type RuntimeRequest =
  | { type: typeof MESSAGE_TYPE.GET_STATE }
  | { type: typeof MESSAGE_TYPE.GET_ACTIVE_TAB_CACHE_STATUS }
  | { type: typeof MESSAGE_TYPE.MARK_STARTED }
  | { type: typeof MESSAGE_TYPE.START_GOOGLE_AUTH }
  | { type: typeof MESSAGE_TYPE.DISCONNECT_GOOGLE }
  | {
      type: typeof MESSAGE_TYPE.SAVE_API_KEY;
      provider: ApiProvider;
      value: string;
    }
  | {
      type: typeof MESSAGE_TYPE.SAVE_CUSTOM_DRAFT_PROMPT;
      value: string;
    }
  | {
      type: typeof MESSAGE_TYPE.CLEAR_PIPELINE_CACHE;
      scope: "all";
    }
  | {
      type: typeof MESSAGE_TYPE.CLEAR_PIPELINE_CACHE;
      scope: "domain";
      domain: string;
    }
  | {
      type: typeof MESSAGE_TYPE.START_PIPELINE;
      countdownSeconds?: number;
      mode?: PipelineRunMode;
    }
  | {
      type: typeof MESSAGE_TYPE.SUBMIT_EMAIL;
      payload: DraftAndSendRequest;
    }
  | {
      type: typeof MESSAGE_TYPE.SAVE_EMAIL_DRAFT;
      payload: DraftAndSendRequest;
    }
  | {
      type: typeof MESSAGE_TYPE.GET_PAST_OUTREACHES;
      syncDraftStatuses?: boolean;
    };

export type RuntimeResponse =
  | {
      ok: true;
      type: "STATE";
      state: OnboardingState;
    }
  | {
      ok: true;
      type: typeof MESSAGE_TYPE.AUTH_STATUS_CHANGED;
      state: OnboardingState;
    }
  | {
      ok: true;
      type: typeof MESSAGE_TYPE.PIPELINE_RESULT;
      result: PipelineResult;
    }
  | {
      ok: true;
      type: typeof MESSAGE_TYPE.ACTIVE_TAB_CACHE_STATUS;
      hostname?: string;
      hasCache: boolean;
    }
  | {
      ok: true;
      type: typeof MESSAGE_TYPE.PIPELINE_CACHE_CLEARED;
      scope: "domain" | "all";
      domain?: string;
    }
  | {
      ok: true;
      type: typeof MESSAGE_TYPE.EMAIL_SENT;
      draftId: string;
      messageId: string;
      gmailUrl: string;
    }
  | {
      ok: true;
      type: typeof MESSAGE_TYPE.EMAIL_DRAFT_SAVED;
      draftId: string;
      messageId: string;
      gmailUrl: string;
    }
  | {
      ok: true;
      type: typeof MESSAGE_TYPE.PAST_OUTREACHES;
      items: OutreachRecord[];
    }
  | {
      ok: false;
      type: typeof MESSAGE_TYPE.PIPELINE_ERROR;
      error: string;
    };

export const isRuntimeRequest = (value: unknown): value is RuntimeRequest => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeType = (value as { type?: unknown }).type;

  if (typeof maybeType !== "string") {
    return false;
  }

  return REQUEST_MESSAGE_TYPES.includes(maybeType as (typeof REQUEST_MESSAGE_TYPES)[number]);
};
