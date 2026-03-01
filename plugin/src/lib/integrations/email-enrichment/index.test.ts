import { describe, expect, it, vi } from "vitest";
import { enrichCandidatesWithEmailProviders } from "./index";

describe("enrichCandidatesWithEmailProviders", () => {
  it("uses mock provider first and avoids RocketReach API calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      const result = await enrichCandidatesWithEmailProviders({
        domain: "acme.com",
        candidates: [
          {
            name: "Jane Doe",
            role: "ceo",
            score: 0.9,
            source: "mistral"
          }
        ],
        maxCandidates: 8,
        apiKeys: {
          rocketreach: "dummy-key"
        }
      });

      expect(result[0]?.source).toBe("mock");
      expect(result[0]?.email).toContain("acme.com");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
