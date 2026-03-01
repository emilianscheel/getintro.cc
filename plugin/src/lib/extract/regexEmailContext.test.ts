import { describe, expect, it } from "vitest";
import { buildRegexEmailDisplayContexts, REGEX_SOURCE_PAGE_TEXT_MAX_CHARS } from "./regexEmailContext";
import type { CrawlPage } from "../types";

describe("buildRegexEmailDisplayContexts", () => {
  it("uses the first matching page for each regex email and deduplicates email keys", () => {
    const pages: CrawlPage[] = [
      {
        url: "https://example.com/about",
        depth: 0,
        rawHtml: "<html></html>",
        strippedText: "About page text",
        emailsFound: ["info@example.com", "founder@example.com"]
      },
      {
        url: "https://example.com/team",
        depth: 1,
        rawHtml: "<html></html>",
        strippedText: "Team page text",
        emailsFound: ["founder@example.com"]
      }
    ];

    const contexts = buildRegexEmailDisplayContexts(pages, [
      "FOUNDER@example.com",
      "info@example.com",
      "founder@example.com"
    ]);

    expect(contexts).toEqual([
      {
        email: "founder@example.com",
        sourceUrl: "https://example.com/about",
        sourcePageText: "About page text"
      },
      {
        email: "info@example.com",
        sourceUrl: "https://example.com/about",
        sourcePageText: "About page text"
      }
    ]);
  });

  it("caps source page text to the configured max length", () => {
    const longText = "a".repeat(REGEX_SOURCE_PAGE_TEXT_MAX_CHARS + 100);
    const pages: CrawlPage[] = [
      {
        url: "https://example.com",
        depth: 0,
        rawHtml: "<html></html>",
        strippedText: longText,
        emailsFound: ["info@example.com"]
      }
    ];

    const [context] = buildRegexEmailDisplayContexts(pages, ["info@example.com"]);

    expect(context?.sourcePageText?.length).toBe(REGEX_SOURCE_PAGE_TEXT_MAX_CHARS);
  });
});
