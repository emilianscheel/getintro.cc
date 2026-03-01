import { describe, expect, it } from "vitest";
import type { CachedDomainPipelinePool, PipelineResult } from "../types";
import { candidatePoolKey, mergePipelineResultIntoPool } from "./pipelinePool";

describe("candidatePoolKey", () => {
  it("prefers normalized email as dedupe key", () => {
    expect(
      candidatePoolKey({
        name: "Vera Scheel",
        role: "Founder",
        email: "Info@Vera-Scheel.de",
        score: 0.9,
        source: "regex"
      })
    ).toBe("email:info@vera-scheel.de");
  });

  it("falls back to normalized name and role when email is missing", () => {
    expect(
      candidatePoolKey({
        name: " Vera Scheel ",
        role: " Founder ",
        score: 0.6,
        source: "mistral"
      })
    ).toBe("nameRole:vera scheel|founder");
  });
});

describe("mergePipelineResultIntoPool", () => {
  it("dedupes by email and unions visited urls and regex emails", () => {
    const existingPool: CachedDomainPipelinePool = {
      domain: "example.com",
      visitedUrls: ["https://example.com"],
      emailsRegex: ["a@example.com"],
      candidates: [
        {
          name: "Alice",
          role: "Founder",
          email: "a@example.com",
          score: 0.8,
          source: "mistral"
        }
      ],
      multiRecipientDraftSubject: "Existing subject",
      multiRecipientDraft: "Existing draft",
      updatedAtMs: 1
    };

    const freshResult: PipelineResult = {
      domain: "example.com",
      visitedUrls: ["https://example.com/about"],
      emailsRegex: ["a@example.com", "b@example.com"],
      candidates: [
        {
          name: "Alice Updated",
          role: "CEO",
          email: "A@example.com",
          score: 0.9,
          source: "regex"
        },
        {
          name: "Bob",
          role: "CTO",
          email: "b@example.com",
          score: 0.7,
          source: "mistral"
        }
      ],
      multiRecipientDraftSubject: "",
      multiRecipientDraft: "",
      partial: false,
      stoppedAtMs: 123
    };

    const merged = mergePipelineResultIntoPool(existingPool, freshResult);

    expect(merged.candidates).toHaveLength(2);
    expect(merged.candidates[0].email).toBe("a@example.com");
    expect(merged.candidates[1].email).toBe("b@example.com");
    expect(merged.visitedUrls).toEqual([
      "https://example.com",
      "https://example.com/about"
    ]);
    expect(merged.emailsRegex).toEqual(["a@example.com", "b@example.com"]);
    expect(merged.multiRecipientDraftSubject).toBe("Existing subject");
    expect(merged.multiRecipientDraft).toBe("Existing draft");
  });

  it("uses name+role fallback dedupe and keeps latest non-empty multi draft subject and body", () => {
    const freshResult: PipelineResult = {
      domain: "example.com",
      visitedUrls: [],
      emailsRegex: [],
      candidates: [
        {
          name: "Vera Scheel",
          role: "Founder",
          score: 0.9,
          source: "regex"
        }
      ],
      multiRecipientDraftSubject: "Fresh subject",
      multiRecipientDraft: "Fresh draft",
      partial: false,
      stoppedAtMs: 100
    };

    const mergedOnce = mergePipelineResultIntoPool(undefined, freshResult);
    const mergedTwice = mergePipelineResultIntoPool(mergedOnce, {
      ...freshResult,
      candidates: [
        {
          name: " vera scheel ",
          role: " founder ",
          score: 0.4,
          source: "mistral"
        }
      ],
      multiRecipientDraftSubject: "",
      multiRecipientDraft: ""
    });

    expect(mergedOnce.multiRecipientDraftSubject).toBe("Fresh subject");
    expect(mergedOnce.multiRecipientDraft).toBe("Fresh draft");
    expect(mergedTwice.multiRecipientDraftSubject).toBe("Fresh subject");
    expect(mergedTwice.multiRecipientDraft).toBe("Fresh draft");
    expect(mergedTwice.candidates).toHaveLength(1);
  });
});
