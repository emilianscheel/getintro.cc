import { describe, expect, it } from "vitest";
import { getCandidateDraftPrompt, getGenericDraftPrompt } from "./generateDrafts";

describe("draft prompt builders", () => {
  it("includes VC context, sender context and custom instructions for candidate drafts", () => {
    const prompt = getCandidateDraftPrompt(
      "acme.com",
      "Jane Sender",
      "jane@vc.com",
      "Prefer proposing a Zoom call."
    );

    expect(prompt).toContain("venture capital partners");
    expect(prompt).toContain("subject must be concise, readable, and plain text");
    expect(prompt).toContain("2-3 short sentences");
    expect(prompt).toContain("Sender context:");
    expect(prompt).toContain("- Sender name: Jane Sender");
    expect(prompt).toContain("- Sender email: jane@vc.com");
    expect(prompt).toContain("Do not include sender email in the signoff.");
    expect(prompt).toContain("Additional message prompt from the plugin user:");
    expect(prompt).toContain("Prefer proposing a Zoom call.");
    expect(prompt).toContain("Example drafts:");
  });

  it("keeps neutral closing guidance when sender name is missing", () => {
    const prompt = getGenericDraftPrompt("acme.com", undefined, "jane@vc.com", "");

    expect(prompt).toContain("Return JSON fields: subject and draft.");
    expect(prompt).toContain("subject must be concise, readable, and plain text");
    expect(prompt).toContain("If sender name is missing, do not invent one.");
    expect(prompt).toContain("neutral closing");
  });
});
