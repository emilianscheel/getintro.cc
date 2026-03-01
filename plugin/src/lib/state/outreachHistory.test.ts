import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendOutreachRecord, getOutreachHistory, setOutreachHistory } from "./storage";

const OUTREACH_HISTORY_STORAGE_KEY = "outreach-history";

vi.mock("../security/crypto", () => {
  return {
    encryptSecret: vi.fn(async (value: string) => ({
      ciphertextB64: `enc:${value}`,
      ivB64: "iv",
      version: 1 as const
    })),
    decryptSecret: vi.fn(async (envelope: { ciphertextB64: string }) => {
      if (!envelope.ciphertextB64.startsWith("enc:")) {
        throw new Error("invalid encrypted payload");
      }

      return envelope.ciphertextB64.slice(4);
    })
  };
});

const setupChromeStorageMock = (initialState?: Record<string, unknown>) => {
  const store: Record<string, unknown> = { ...(initialState ?? {}) };

  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (key: string) => ({
          [key]: store[key]
        }),
        set: async (value: Record<string, unknown>) => {
          Object.assign(store, value);
        }
      }
    }
  });
};

describe("outreach history storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("stores encrypted records and returns newest first", async () => {
    setupChromeStorageMock();

    await appendOutreachRecord({
      id: "record-1",
      createdAtMs: 1,
      status: "sent",
      hostname: "example.com",
      toEmail: "hello@example.com",
      bccEmails: [],
      recipientEmail: "hello@example.com",
      senderEmail: "sender@example.com",
      subject: "Subject 1",
      body: "Body 1",
      gmailUrl: "https://mail.google.com/mail/u/0/#all/thread-1",
      gmailMessageId: "message-1",
      gmailThreadId: "thread-1"
    });

    await appendOutreachRecord({
      id: "record-2",
      createdAtMs: 2,
      status: "draft",
      hostname: "example.com",
      toEmail: "contact@example.com",
      bccEmails: ["team@example.com"],
      recipientEmail: "contact@example.com",
      senderEmail: "sender@example.com",
      subject: "Subject 2",
      body: "Body 2",
      gmailUrl: "https://mail.google.com/mail/u/0/#all/thread-2",
      gmailDraftId: "draft-2"
    });

    const history = await getOutreachHistory();

    expect(history).toHaveLength(2);
    expect(history[0]?.id).toBe("record-2");
    expect(history[1]?.id).toBe("record-1");
  });

  it("skips records that fail decryption", async () => {
    setupChromeStorageMock({
      [OUTREACH_HISTORY_STORAGE_KEY]: [
        {
          ciphertextB64:
            'enc:{"id":"good","createdAtMs":10,"status":"sent","hostname":"example.com","toEmail":"hello@example.com","bccEmails":[],"recipientEmail":"hello@example.com","senderEmail":"sender@example.com","subject":"Subject","body":"Body","gmailUrl":"https://mail.google.com/mail/u/0/#all/thread"}',
          ivB64: "iv",
          version: 1
        },
        {
          ciphertextB64: "broken",
          ivB64: "iv",
          version: 1
        }
      ]
    });

    const history = await getOutreachHistory();

    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe("good");
  });

  it("normalizes legacy records without toEmail and bccEmails", async () => {
    setupChromeStorageMock({
      [OUTREACH_HISTORY_STORAGE_KEY]: [
        {
          ciphertextB64:
            'enc:{"id":"legacy","createdAtMs":10,"status":"draft","hostname":"legacy.com","recipientEmail":"legacy@company.com","senderEmail":"sender@example.com","subject":"Legacy","body":"Legacy body","gmailUrl":"https://mail.google.com/mail/u/0/#all/thread"}',
          ivB64: "iv",
          version: 1
        }
      ]
    });

    const history = await getOutreachHistory();

    expect(history).toHaveLength(1);
    expect(history[0]?.toEmail).toBe("legacy@company.com");
    expect(history[0]?.bccEmails).toEqual([]);
  });

  it("replaces history with setOutreachHistory", async () => {
    setupChromeStorageMock();

    await appendOutreachRecord({
      id: "record-1",
      createdAtMs: 1,
      status: "sent",
      hostname: "example.com",
      toEmail: "first@example.com",
      bccEmails: [],
      recipientEmail: "first@example.com",
      senderEmail: "sender@example.com",
      subject: "First",
      body: "Body",
      gmailUrl: "https://mail.google.com/mail/u/0/#all/first"
    });

    await setOutreachHistory([
      {
        id: "record-2",
        createdAtMs: 2,
        status: "draft",
        hostname: "example.com",
        toEmail: "second@example.com",
        bccEmails: ["bcc@example.com"],
        recipientEmail: "second@example.com",
        senderEmail: "sender@example.com",
        subject: "Second",
        body: "Body",
        gmailUrl: "https://mail.google.com/mail/u/0/#all/second",
        gmailDraftId: "draft-2"
      }
    ]);

    const history = await getOutreachHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe("record-2");
    expect(history[0]?.status).toBe("draft");
  });
});
