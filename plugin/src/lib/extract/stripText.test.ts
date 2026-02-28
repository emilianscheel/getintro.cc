import { describe, expect, it } from "vitest";
import { stripHtmlToText } from "./stripText";

describe("stripHtmlToText", () => {
  it("removes script and html tags", () => {
    const html =
      "<html><body><script>alert(1)</script><h1>Hello</h1><p>World</p></body></html>";

    expect(stripHtmlToText(html)).toBe("Hello World");
  });

  it("decodes common entities", () => {
    const html = "<p>Tom &amp; Jerry&nbsp;&lt;test&gt;</p>";
    expect(stripHtmlToText(html)).toBe("Tom & Jerry <test>");
  });
});
