import { describe, expect, it } from "vitest";
import { isRuntimeRequest, MESSAGE_TYPE } from "./messages";

describe("isRuntimeRequest", () => {
  it("accepts SAVE_CUSTOM_DRAFT_PROMPT requests", () => {
    expect(
      isRuntimeRequest({
        type: MESSAGE_TYPE.SAVE_CUSTOM_DRAFT_PROMPT,
        value: "Prefer in-person meetings."
      })
    ).toBe(true);
  });

  it("accepts START_PIPELINE requests with mode", () => {
    expect(
      isRuntimeRequest({
        type: MESSAGE_TYPE.START_PIPELINE,
        mode: "fresh_only"
      })
    ).toBe(true);
  });

  it("accepts GET_ACTIVE_TAB_CACHE_STATUS requests", () => {
    expect(
      isRuntimeRequest({
        type: MESSAGE_TYPE.GET_ACTIVE_TAB_CACHE_STATUS
      })
    ).toBe(true);
  });

  it("accepts CLEAR_PIPELINE_CACHE all scope requests", () => {
    expect(
      isRuntimeRequest({
        type: MESSAGE_TYPE.CLEAR_PIPELINE_CACHE,
        scope: "all"
      })
    ).toBe(true);
  });

  it("accepts CLEAR_PIPELINE_CACHE domain scope requests", () => {
    expect(
      isRuntimeRequest({
        type: MESSAGE_TYPE.CLEAR_PIPELINE_CACHE,
        scope: "domain",
        domain: "example.com"
      })
    ).toBe(true);
  });

  it("accepts SAVE_EMAIL_DRAFT requests", () => {
    expect(
      isRuntimeRequest({
        type: MESSAGE_TYPE.SAVE_EMAIL_DRAFT,
        payload: {
          fromEmail: "sender@example.com",
          toEmail: "recipient@example.com",
          subject: "Hi",
          message: "Hello",
          hostname: "example.com"
        }
      })
    ).toBe(true);
  });

  it("accepts GET_PAST_OUTREACHES requests", () => {
    expect(
      isRuntimeRequest({
        type: MESSAGE_TYPE.GET_PAST_OUTREACHES
      })
    ).toBe(true);
  });

  it("accepts GET_PAST_OUTREACHES sync requests", () => {
    expect(
      isRuntimeRequest({
        type: MESSAGE_TYPE.GET_PAST_OUTREACHES,
        syncDraftStatuses: true
      })
    ).toBe(true);
  });
});
