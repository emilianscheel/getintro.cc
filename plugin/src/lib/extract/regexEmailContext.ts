import type { CrawlPage, RegexEmailDisplayContext } from "../types";

export const REGEX_SOURCE_PAGE_TEXT_MAX_CHARS = 40_000;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const buildRegexEmailDisplayContexts = (
  pages: CrawlPage[],
  regexEmails: string[]
): RegexEmailDisplayContext[] => {
  const seen = new Set<string>();
  const contexts: RegexEmailDisplayContext[] = [];

  for (const rawEmail of regexEmails) {
    const email = normalizeEmail(rawEmail);

    if (!email || seen.has(email)) {
      continue;
    }

    seen.add(email);

    const sourcePage = pages.find((page) =>
      page.emailsFound.some((pageEmail) => normalizeEmail(pageEmail) === email)
    );

    contexts.push({
      email,
      sourceUrl: sourcePage?.url,
      sourcePageText: sourcePage?.strippedText.slice(0, REGEX_SOURCE_PAGE_TEXT_MAX_CHARS)
    });
  }

  return contexts;
};
