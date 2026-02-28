import type { CrawlPage } from "../types";
import { normalizeUrl, isSameHostname } from "./normalizeUrl";
import { stripHtmlToText } from "../extract/stripText";
import { extractEmails } from "../extract/emailRegex";

type QueueItem = {
  url: string;
  depth: 0 | 1 | 2;
  initialHtml?: string;
  initialLinks?: string[];
};

type CrawlSiteInput = {
  tabId: number;
  startUrl: string;
  maxDepth: 2;
  maxPages: number;
  deadlineAt: number;
};

export type CrawlSiteResult = {
  pages: CrawlPage[];
  visitedUrls: string[];
  emailsRegex: string[];
  combinedText: string;
  partial: boolean;
};

type TabSnapshot = {
  url: string;
  html: string;
  links: string[];
};

const HREF_REGEX = /href\s*=\s*["']([^"']+)["']/gi;

const isHttpLike = (value: string): boolean =>
  value.startsWith("http://") || value.startsWith("https://");

const withDeadlineFetch = async (
  url: string,
  deadlineAt: number
): Promise<string> => {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) {
    throw new Error("Deadline reached before fetch.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remaining);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const extractLinksFromHtml = (html: string, baseUrl: string): string[] => {
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = HREF_REGEX.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) {
      continue;
    }

    try {
      const resolved = new URL(href, baseUrl).toString();
      if (isHttpLike(resolved)) {
        links.push(resolved);
      }
    } catch {
      // Ignore malformed links.
    }
  }

  return links;
};

const snapshotCurrentTab = async (tabId: number): Promise<TabSnapshot> => {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    func: () => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href]")
      ).map((anchor) => anchor.href);

      return {
        url: window.location.href,
        html: document.documentElement?.outerHTML ?? "",
        links
      };
    }
  });

  const payload = results[0]?.result as TabSnapshot | undefined;

  if (!payload) {
    throw new Error("Unable to read the active tab content.");
  }

  return payload;
};

export const crawlSite = async ({
  tabId,
  startUrl,
  maxDepth,
  maxPages,
  deadlineAt
}: CrawlSiteInput): Promise<CrawlSiteResult> => {
  const snapshot = await snapshotCurrentTab(tabId);
  const normalizedStart = normalizeUrl(startUrl);

  if (!normalizedStart) {
    throw new Error("Only http(s) pages are supported.");
  }

  const queue: QueueItem[] = [
    {
      url: normalizedStart,
      depth: 0,
      initialHtml: snapshot.html,
      initialLinks: snapshot.links
    }
  ];

  const visited = new Set<string>();
  const enqueued = new Set<string>([normalizedStart]);
  const pages: CrawlPage[] = [];
  const emails = new Set<string>();
  let partial = false;

  while (queue.length > 0 && visited.size < maxPages) {
    if (Date.now() >= deadlineAt) {
      partial = true;
      break;
    }

    const current = queue.shift();

    if (!current) {
      break;
    }

    if (visited.has(current.url)) {
      continue;
    }

    visited.add(current.url);

    let html = current.initialHtml;
    let links = current.initialLinks;

    if (!html) {
      try {
        html = await withDeadlineFetch(current.url, deadlineAt);
        links = extractLinksFromHtml(html, current.url);
      } catch {
        partial = true;
        continue;
      }
    }

    const strippedText = stripHtmlToText(html);
    const pageEmails = extractEmails(strippedText);
    pageEmails.forEach((email) => emails.add(email));

    pages.push({
      url: current.url,
      depth: current.depth,
      rawHtml: html,
      strippedText,
      emailsFound: pageEmails
    });

    if (current.depth >= maxDepth || !links?.length) {
      continue;
    }

    for (const rawLink of links) {
      const normalized = normalizeUrl(rawLink);

      if (!normalized) {
        continue;
      }

      if (!isSameHostname(normalizedStart, normalized)) {
        continue;
      }

      if (visited.has(normalized) || enqueued.has(normalized)) {
        continue;
      }

      if (visited.size + queue.length >= maxPages) {
        break;
      }

      enqueued.add(normalized);
      queue.push({
        url: normalized,
        depth: (current.depth + 1) as 0 | 1 | 2
      });
    }
  }

  return {
    pages,
    visitedUrls: Array.from(visited),
    emailsRegex: Array.from(emails),
    combinedText: pages.map((page) => page.strippedText).join("\n\n"),
    partial
  };
};
