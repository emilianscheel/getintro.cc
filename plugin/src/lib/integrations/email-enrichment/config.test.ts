import { describe, expect, it } from "vitest";
import {
  EMAIL_ENRICHMENT_PROVIDER_CHAIN,
  ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING
} from "./config";

describe("email enrichment config", () => {
  it("defaults to mock-first provider chain", () => {
    expect(EMAIL_ENRICHMENT_PROVIDER_CHAIN[0]).toBe("mock");
    expect(EMAIL_ENRICHMENT_PROVIDER_CHAIN).toContain("rocketreach");
  });

  it("does not require RocketReach key when mock is in chain", () => {
    expect(ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING).toBe(false);
  });
});
