import { describe, expect, it } from "vitest";
import { buildGmailDraftUrl, buildGmailMessageUrl } from "./gmail";

describe("buildGmailMessageUrl", () => {
  it("uses threadId when available", () => {
    expect(
      buildGmailMessageUrl({
        id: "message-id",
        threadId: "thread-id"
      })
    ).toBe("https://mail.google.com/mail/u/0/#all/thread-id");
  });

  it("falls back to message id when threadId is missing", () => {
    expect(
      buildGmailMessageUrl({
        id: "message-id"
      })
    ).toBe("https://mail.google.com/mail/u/0/#all/message-id");
  });

  it("falls back to sent folder when both ids are missing", () => {
    expect(buildGmailMessageUrl({})).toBe("https://mail.google.com/mail/u/0/#sent");
  });

  it("trims thread and message identifiers", () => {
    expect(
      buildGmailMessageUrl({
        id: "  message-id  ",
        threadId: "  thread-id  "
      })
    ).toBe("https://mail.google.com/mail/u/0/#all/thread-id");
  });

  it("falls back to sent folder when ids are blank", () => {
    expect(
      buildGmailMessageUrl({
        id: "   ",
        threadId: "   "
      })
    ).toBe("https://mail.google.com/mail/u/0/#sent");
  });
});

describe("buildGmailDraftUrl", () => {
  it("uses threadId when available", () => {
    expect(
      buildGmailDraftUrl({
        id: "message-id",
        threadId: "thread-id"
      })
    ).toBe("https://mail.google.com/mail/u/0/#all/thread-id");
  });

  it("falls back to drafts folder when both ids are missing", () => {
    expect(buildGmailDraftUrl({})).toBe("https://mail.google.com/mail/u/0/#drafts");
  });

  it("falls back to drafts folder when ids are blank", () => {
    expect(
      buildGmailDraftUrl({
        id: "   ",
        threadId: "   "
      })
    ).toBe("https://mail.google.com/mail/u/0/#drafts");
  });
});
