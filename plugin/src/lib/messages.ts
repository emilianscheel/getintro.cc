import type {
  ApiProvider,
  DraftAndSendRequest,
  OnboardingState,
  PipelineResult
} from "./types";

export const MESSAGE_TYPE = {
  GET_STATE: "GET_STATE",
  MARK_STARTED: "MARK_STARTED",
  START_GOOGLE_AUTH: "START_GOOGLE_AUTH",
  DISCONNECT_GOOGLE: "DISCONNECT_GOOGLE",
  SAVE_API_KEY: "SAVE_API_KEY",
  START_PIPELINE: "START_PIPELINE",
  SUBMIT_EMAIL: "SUBMIT_EMAIL",
  AUTH_STATUS_CHANGED: "AUTH_STATUS_CHANGED",
  PIPELINE_RESULT: "PIPELINE_RESULT",
  PIPELINE_ERROR: "PIPELINE_ERROR",
  EMAIL_SENT: "EMAIL_SENT"
} as const;

const REQUEST_MESSAGE_TYPES = [
  MESSAGE_TYPE.GET_STATE,
  MESSAGE_TYPE.MARK_STARTED,
  MESSAGE_TYPE.START_GOOGLE_AUTH,
  MESSAGE_TYPE.DISCONNECT_GOOGLE,
  MESSAGE_TYPE.SAVE_API_KEY,
  MESSAGE_TYPE.START_PIPELINE,
  MESSAGE_TYPE.SUBMIT_EMAIL
] as const;

export type RuntimeRequest =
  | { type: typeof MESSAGE_TYPE.GET_STATE }
  | { type: typeof MESSAGE_TYPE.MARK_STARTED }
  | { type: typeof MESSAGE_TYPE.START_GOOGLE_AUTH }
  | { type: typeof MESSAGE_TYPE.DISCONNECT_GOOGLE }
  | {
      type: typeof MESSAGE_TYPE.SAVE_API_KEY;
      provider: ApiProvider;
      value: string;
    }
  | {
      type: typeof MESSAGE_TYPE.START_PIPELINE;
      countdownSeconds?: number;
    }
  | {
      type: typeof MESSAGE_TYPE.SUBMIT_EMAIL;
      payload: DraftAndSendRequest;
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
      type: typeof MESSAGE_TYPE.EMAIL_SENT;
      draftId: string;
      messageId: string;
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
