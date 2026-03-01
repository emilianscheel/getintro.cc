import { describe, expect, it } from "vitest";
import {
  getHttpHostnameFromUrl,
  shouldPersistPipelinePoolForEpoch
} from "./pipelineCacheControl";

describe("getHttpHostnameFromUrl", () => {
  it("returns hostname for valid http urls", () => {
    expect(getHttpHostnameFromUrl("https://example.com/path")).toBe("example.com");
    expect(getHttpHostnameFromUrl("http://foo.bar")).toBe("foo.bar");
  });

  it("returns undefined for invalid or non-http urls", () => {
    expect(getHttpHostnameFromUrl(undefined)).toBeUndefined();
    expect(getHttpHostnameFromUrl("chrome://extensions")).toBeUndefined();
    expect(getHttpHostnameFromUrl("not-a-url")).toBeUndefined();
  });
});

describe("shouldPersistPipelinePoolForEpoch", () => {
  it("allows writes only when run epoch matches current epoch", () => {
    expect(shouldPersistPipelinePoolForEpoch(3, 3)).toBe(true);
    expect(shouldPersistPipelinePoolForEpoch(3, 4)).toBe(false);
  });
});
