import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOnboardingState, patchOnboardingState } from "./storage";

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
