import { describe, expect, it } from "vitest";
import { isSameHostname, normalizeUrl } from "./normalizeUrl";

describe("normalizeUrl", () => {
  it("normalizes valid http urls and strips hash", () => {
    expect(normalizeUrl("https://example.com/path/#section")).toBe(
      "https://example.com/path"
    );
  });

  it("returns null for unsupported protocols", () => {
    expect(normalizeUrl("mailto:hello@example.com")).toBeNull();
  });
});

describe("isSameHostname", () => {
  it("detects same host", () => {
    expect(
      isSameHostname("https://example.com/about", "https://example.com/team")
    ).toBe(true);
  });

  it("detects different host", () => {
    expect(
      isSameHostname("https://example.com", "https://other.com")
    ).toBe(false);
  });
});
