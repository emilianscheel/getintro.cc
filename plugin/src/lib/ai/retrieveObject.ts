import { createMistral } from "@ai-sdk/mistral";
import { generateObject } from "ai";
import { z } from "zod";
import { extractEmails } from "../extract/emailRegex";
import { logError, logInfo, previewText } from "../logging";
import type { Candidate } from "../types";

const MAX_EMAIL_CONTEXT_COUNT = 200;
const STRICT_EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

const candidateSchema = z.object({
  name: z.string().min(1),
  score: z.number(),
  role: z.string().min(1),
  email: z.string().optional()
});

const responseSchema = z.object({
  candidates: z.array(candidateSchema).max(25)
});

type RetrieveObjectInput = {
  apiKey: string;
  domain: string;
  text: string;
  regexEmails: string[];
  signal?: AbortSignal;
};

type RetrieveRegexEmailDisplayInput = {
  apiKey: string;
  domain: string;
  regexEmails: string[];
  signal?: AbortSignal;
};

const regexDisplayCandidateSchema = z.object({
  email: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  score: z.number().optional()
});

const regexDisplayResponseSchema = z.object({
  candidates: z.array(regexDisplayCandidateSchema).max(200)
});

const clampScore = (score: number): number => {
  if (Number.isNaN(score)) {
    return 0;
  }

  return Math.min(1, Math.max(0, score));
};

const normalizeEmail = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (!STRICT_EMAIL_REGEX.test(normalized)) {
    return undefined;
  }

  return normalized;
};

const dedupeEmails = (emails: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const email of emails) {
    const normalized = normalizeEmail(email);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
};

const decodeObfuscatedEmailText = (text: string): string => {
  return text
    .replace(/\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}/gi, "@")
    .replace(/\s+at\s+/gi, "@")
    .replace(/\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}/gi, ".")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".");
};

const extractObfuscatedEmails = (text: string): string[] => {
  return dedupeEmails(extractEmails(decodeObfuscatedEmailText(text)));
};

const formatEmailList = (emails: string[]): string => {
  if (emails.length === 0) {
    return "(none)";
  }

  return emails.map((email) => `- ${email}`).join("\n");
};

export const retrieveObject = async ({
  apiKey,
  domain,
  text,
  regexEmails,
  signal
}: RetrieveObjectInput): Promise<Candidate[]> => {
  const modelId = "mistral-small-latest";
  const model = createMistral({ apiKey })(modelId);
  const normalizedRegexEmails = dedupeEmails(regexEmails);
  const plainTextEmails = dedupeEmails(extractEmails(text));
  const obfuscatedEmails = extractObfuscatedEmails(text);
  const evidencedEmails = dedupeEmails([
    ...normalizedRegexEmails,
    ...plainTextEmails,
    ...obfuscatedEmails
  ]);
  const evidencedEmailSet = new Set(evidencedEmails);
  const regexEmailContext = normalizedRegexEmails.slice(0, MAX_EMAIL_CONTEXT_COUNT);
  const obfuscatedEmailContext = obfuscatedEmails
    .filter((email) => !normalizedRegexEmails.includes(email))
    .slice(0, MAX_EMAIL_CONTEXT_COUNT);

  const prompt = [
    `Analyze the following company website text for domain ${domain}.`,
    "Return candidate people that could be relevant outreach targets, especially based on the provided regex-extracted emails.",
    "Output name, role and a confidence score between 0 and 1. Optionally include email only when directly evidenced.",
    "For each regex-extracted email, try to provide a reasonable candidate name and role guess.",
    "Do not default to generic local-part names like info, contact, hello, or support as the person's name.",
    "If local-part is generic but domain suggests a person name (for example info@firstname-lastname.com), infer from the stronger signal and use a lower confidence.",
    "Prefer co-founders, C-level, and leadership roles.",
    "Use regex-extracted emails to infer likely name and role when reasonable.",
    "If a person name is missing but an email suggests one, infer a likely name from the email pattern.",
    "Look for name clues both before and after the @ symbol.",
    "Example (before @): emma.johnson@acme.com -> name \"Emma Johnson\".",
    "Example (after @): contact@johnsmithventures.com -> name \"John Smith\".",
    "Obfuscated email examples: info [at] test.com -> info@test.com.",
    "Obfuscated email examples: jane at acme dot com -> jane@acme.com.",
    "Obfuscated email examples: support(at)example(dot)org -> support@example.org.",
    "Never hallucinate or invent email addresses under any circumstances.",
    "If an email is not explicitly present in the provided regex list or clearly reconstructable from website text, do not output an email.",
    "If uncertain, omit email completely rather than guessing.",
    "When inferring a name from an email pattern, use a lower confidence score.",
    "If uncertain, still return best guesses with lower score."
  ].join("\n");

  const requestPrompt = [
    prompt,
    "",
    "Regex-extracted emails (high-confidence evidence):",
    formatEmailList(regexEmailContext),
    "",
    "Decoded emails from obfuscated text patterns (if any):",
    formatEmailList(obfuscatedEmailContext),
    "",
    `Website text:\n${text.slice(0, 80_000)}`
  ].join("\n");
  logInfo("mistral", "sending request", {
    model: modelId,
    domain,
    inputTextChars: text.length,
    regexEmailsProvided: normalizedRegexEmails.length,
    plainTextEmails: plainTextEmails.length,
    obfuscatedEmails: obfuscatedEmails.length,
    evidencedEmails: evidencedEmails.length,
    promptChars: requestPrompt.length,
    promptPreview: previewText(requestPrompt, 1_500)
  });

  try {
    const { object } = await generateObject({
      model,
      schema: responseSchema,
      prompt: requestPrompt,
      abortSignal: signal
    });

    logInfo("mistral", "received response", {
      candidates: object.candidates.length,
      payload: object
    });

    let strippedEmailCount = 0;

    const candidates = object.candidates.map((candidate) => {
      const normalizedEmail = normalizeEmail(candidate.email);
      const trustedEmail =
        normalizedEmail && evidencedEmailSet.has(normalizedEmail)
          ? normalizedEmail
          : undefined;

      if (normalizedEmail && !trustedEmail) {
        strippedEmailCount += 1;
      }

      return {
        name: candidate.name.trim(),
        role: candidate.role.trim(),
        score: clampScore(candidate.score),
        email: trustedEmail,
        source: "mistral" as const
      };
    });

    if (strippedEmailCount > 0) {
      logInfo("mistral", "removed non-evidenced model emails", {
        strippedEmailCount
      });
    }

    return candidates;
  } catch (error) {
    logError("mistral", "request failed", error);
    throw error;
  }
};

export const retrieveRegexEmailDisplayCandidates = async ({
  apiKey,
  domain,
  regexEmails,
  signal
}: RetrieveRegexEmailDisplayInput): Promise<Candidate[]> => {
  const normalizedRegexEmails = dedupeEmails(regexEmails).slice(0, MAX_EMAIL_CONTEXT_COUNT);

  if (normalizedRegexEmails.length === 0) {
    return [];
  }

  const modelId = "mistral-small-latest";
  const model = createMistral({ apiKey })(modelId);
  const providedEmails = new Set(normalizedRegexEmails);

  const prompt = [
    `You are enriching regex-extracted email addresses for domain ${domain}.`,
    "Return one candidate per provided email with name, role, and optional confidence score.",
    "Focus only on display quality for name and role. Do not invent new emails.",
    "Use the exact email from the provided list.",
    "If local-part is generic (info/contact/hello/support), infer person name from domain tokens when possible.",
    "Example: info@vera-scheel.de -> name \"Vera Scheel\".",
    "If role is uncertain, use \"unknown\".",
    "Never add emails that are not in the provided list."
  ].join("\n");

  const requestPrompt = [
    prompt,
    "",
    "Regex-extracted emails:",
    formatEmailList(normalizedRegexEmails)
  ].join("\n");

  logInfo("mistral:regex-display", "sending request", {
    model: modelId,
    domain,
    regexEmailsProvided: normalizedRegexEmails.length,
    promptChars: requestPrompt.length,
    promptPreview: previewText(requestPrompt, 1_500)
  });

  try {
    const { object } = await generateObject({
      model,
      schema: regexDisplayResponseSchema,
      prompt: requestPrompt,
      abortSignal: signal
    });

    logInfo("mistral:regex-display", "received response", {
      candidates: object.candidates.length,
      payload: object
    });

    const mappedCandidates: Candidate[] = [];

    for (const candidate of object.candidates) {
      const normalizedEmail = normalizeEmail(candidate.email);

      if (!normalizedEmail || !providedEmails.has(normalizedEmail)) {
        continue;
      }

      mappedCandidates.push({
        name: candidate.name.trim(),
        role: candidate.role.trim(),
        score: clampScore(candidate.score ?? 0.35),
        email: normalizedEmail,
        source: "mistral"
      });
    }

    return mappedCandidates;
  } catch (error) {
    logError("mistral:regex-display", "request failed", error);
    throw error;
  }
};
