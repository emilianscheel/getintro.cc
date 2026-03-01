import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithGoogle } from "./google";

type ChromeIdentity = {
  getAuthToken: (details: { interactive: boolean }, cb: (token?: string) => void) => void;
  removeCachedAuthToken: (details: { token: string }, cb: () => void) => void;
};

const setChromeMock = (identity: ChromeIdentity) => {
  vi.stubGlobal("chrome", {
    identity,
    runtime: {
      lastError: null
    }
  });
};

describe("signInWithGoogle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns name and email from user info when available", async () => {
    setChromeMock({
      getAuthToken: (_details, cb) => cb("token-1"),
      removeCachedAuthToken: (_details, cb) => cb()
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: "alice@example.com", name: "Alice Example" })
    } as Response);

    await expect(signInWithGoogle()).resolves.toEqual({
      email: "alice@example.com",
      name: "Alice Example"
    });
  });

  it("falls back to Gmail profile email when user info has no email", async () => {
    setChromeMock({
      getAuthToken: (_details, cb) => cb("token-2"),
      removeCachedAuthToken: (_details, cb) => cb()
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "Alice Example" })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: "alice@example.com" })
      } as Response);

    await expect(signInWithGoogle()).resolves.toEqual({
      email: "alice@example.com",
      name: "Alice Example"
    });
  });
});
