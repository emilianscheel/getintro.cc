import { describe, expect, it } from "vitest";
import type { Candidate } from "../lib/types";
import { appendUnseenCandidates } from "./pipelineResults";

const candidate = (overrides: Partial<Candidate>): Candidate => ({
  name: "Default",
  role: "Founder",
  score: 0.5,
  source: "mistral",
  ...overrides
});

describe("appendUnseenCandidates", () => {
  it("keeps existing order and appends only unseen candidates", () => {
    const current = [
      candidate({ name: "Alice", email: "alice@example.com" }),
      candidate({ name: "Bob", email: "bob@example.com" })
    ];

    const next = [
      candidate({ name: "Alice 2", email: "ALICE@example.com" }),
      candidate({ name: "Cara", email: "cara@example.com" })
    ];

    const merged = appendUnseenCandidates(current, next);

    expect(merged.addedCount).toBe(1);
    expect(merged.candidates.map((item) => item.email)).toEqual([
      "alice@example.com",
      "bob@example.com",
      "cara@example.com"
    ]);
  });

  it("dedupes by name+role when emails are missing", () => {
    const current = [candidate({ name: "Vera Scheel", role: "Founder", email: undefined })];
    const next = [
      candidate({ name: " vera scheel ", role: " founder ", email: undefined }),
      candidate({ name: "Lina", role: "Partner", email: undefined })
    ];

    const merged = appendUnseenCandidates(current, next);

    expect(merged.addedCount).toBe(1);
    expect(merged.candidates).toHaveLength(2);
  });
});
