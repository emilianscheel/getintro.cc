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
});
