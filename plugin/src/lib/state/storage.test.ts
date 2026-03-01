import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllPipelinePools,
  clearPipelinePool,
  getPipelineCacheEpoch,
  getOnboardingState,
  getPipelinePool,
  getPipelinePools,
  patchOnboardingState,
  setPipelinePool
} from "./storage";

const ONBOARDING_STORAGE_KEY = "onboarding-state";

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

describe("onboarding storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps backward compatibility with legacy state shape", async () => {
    setupChromeStorageMock({
      [ONBOARDING_STORAGE_KEY]: {
        started: true,
        googleConnected: true,
        googleEmail: "legacy@example.com",
        mistralKeySet: true,
        rocketreachKeySet: false,
        completed: true
      }
    });

    const state = await getOnboardingState();

    expect(state.googleName).toBeUndefined();
    expect(state.customDraftPrompt).toBeUndefined();
    expect(state.googleEmail).toBe("legacy@example.com");
  });

  it("persists custom draft prompt updates", async () => {
    setupChromeStorageMock();

    const updated = await patchOnboardingState({
      customDraftPrompt: "Always suggest Zoom."
    });

    expect(updated.customDraftPrompt).toBe("Always suggest Zoom.");
  });
});

describe("pipeline pools storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty map when no pools are stored", async () => {
    setupChromeStorageMock();

    const pools = await getPipelinePools();

    expect(pools).toEqual({});
  });

  it("reads and writes a per-domain pool", async () => {
    setupChromeStorageMock();

    await setPipelinePool("example.com", {
      domain: "example.com",
      visitedUrls: ["https://example.com"],
      emailsRegex: ["hello@example.com"],
      candidates: [],
      multiRecipientDraft: "Draft",
      updatedAtMs: 1
    });

    const pool = await getPipelinePool("example.com");
    const stored = await getPipelinePools();

    expect(pool?.domain).toBe("example.com");
    expect(stored).toEqual(
      expect.objectContaining({
        "example.com": expect.objectContaining({
          emailsRegex: ["hello@example.com"]
        })
      })
    );
  });

  it("clears one domain pool and bumps cache epoch", async () => {
    setupChromeStorageMock();

    await setPipelinePool("example.com", {
      domain: "example.com",
      visitedUrls: [],
      emailsRegex: [],
      candidates: [],
      updatedAtMs: 1
    });
    await setPipelinePool("other.com", {
      domain: "other.com",
      visitedUrls: [],
      emailsRegex: [],
      candidates: [],
      updatedAtMs: 1
    });

    const epochBefore = await getPipelineCacheEpoch();
    await clearPipelinePool("example.com");
    const epochAfter = await getPipelineCacheEpoch();
    const pools = await getPipelinePools();

    expect(epochAfter).toBe(epochBefore + 1);
    expect(pools["example.com"]).toBeUndefined();
    expect(pools["other.com"]).toBeDefined();
  });

  it("clears all pools and bumps cache epoch", async () => {
    setupChromeStorageMock();

    await setPipelinePool("example.com", {
      domain: "example.com",
      visitedUrls: [],
      emailsRegex: [],
      candidates: [],
      updatedAtMs: 1
    });

    const epochBefore = await getPipelineCacheEpoch();
    await clearAllPipelinePools();
    const epochAfter = await getPipelineCacheEpoch();
    const pools = await getPipelinePools();

    expect(epochAfter).toBe(epochBefore + 1);
    expect(pools).toEqual({});
  });
});
