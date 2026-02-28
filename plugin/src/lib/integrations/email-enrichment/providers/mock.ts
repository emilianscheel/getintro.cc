import type { EmailLookupProvider } from "../types";

const sanitizeName = (name: string): string[] => {
  return name
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
};

const normalizeDomain = (domain: string): string => {
  const cleaned = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").trim();
  return cleaned || "example.com";
};

const unique = (items: string[]): string[] => Array.from(new Set(items));

const buildMockEmails = (name: string, domain: string): string[] => {
  const domainPart = normalizeDomain(domain);
  const tokens = sanitizeName(name);

  if (tokens.length === 0) {
    return [
      `contact+unknown@${domainPart}`,
      `hello+unknown@${domainPart}`
    ];
  }

  const first = tokens[0];
  const last = tokens[tokens.length - 1] ?? "person";
  const initials = tokens.map((token) => token[0]).join("");

  return unique([
    `${first}.${last}@${domainPart}`,
    `${first}${last}@${domainPart}`,
    `${initials}@${domainPart}`,
    `${first}+intro@${domainPart}`
  ]);
};

export const mockEmailLookupProvider: EmailLookupProvider = {
  id: "mock",
  requiresApiKey: false,
  lookupEmails: async ({ name, domain, signal }) => {
    if (signal.aborted) {
      throw new Error("Mock lookup aborted.");
    }

    // Keep async behavior to emulate external API latency in development.
    await Promise.resolve();
    return buildMockEmails(name, domain);
  }
};
