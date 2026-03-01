import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGmailDraftUrl,
  buildGmailMessageUrl,
  buildRawMessage,
  getDraftById
} from "./gmail";

vi.mock("../auth/google", () => {
  return {
    getTokenForApi: vi.fn(async () => "test-token"),
    removeCachedToken: vi.fn(async () => {})
  };
});

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(withPadding, "base64").toString("utf8");
};

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

describe("buildRawMessage", () => {
  it("includes Bcc header for multi-recipient payloads", () => {
    const encoded = buildRawMessage({
      fromEmail: "sender@example.com",
      toEmail: "to@example.com",
      bccEmails: ["bcc-a@example.com", "bcc-b@example.com"],
      subject: "Hello",
      message: "Message body"
    });

    const decoded = decodeBase64Url(encoded);

    expect(decoded).toContain("To: to@example.com");
    expect(decoded).toContain("Bcc: bcc-a@example.com, bcc-b@example.com");
  });

  it("omits Bcc header for single-recipient payloads", () => {
    const encoded = buildRawMessage({
      fromEmail: "sender@example.com",
      toEmail: "to@example.com",
      subject: "Hello",
      message: "Message body"
    });

    const decoded = decodeBase64Url(encoded);

    expect(decoded).toContain("To: to@example.com");
    expect(decoded).not.toContain("\r\nBcc:");
  });
});

describe("getDraftById", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when Gmail responds with 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not found", { status: 404 }))
    );

    const result = await getDraftById("missing-draft");
    expect(result).toBeNull();
  });

  it("throws for non-404 Gmail errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Server error", { status: 500 }))
    );

    await expect(getDraftById("draft-id")).rejects.toThrow("Gmail API error (500)");
  });
});
