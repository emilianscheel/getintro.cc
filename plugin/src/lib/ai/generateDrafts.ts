import { createMistral } from "@ai-sdk/mistral";
import { generateObject } from "ai";
import { z } from "zod";
import { logError, logInfo, previewText } from "../logging";
import type { Candidate } from "../types";

const DRAFT_SOURCE_TEXT_MAX_CHARS = 20_000;
const candidateDraftSchema = z.object({
  index: z.number().int().min(0),
  draft: z.string().min(1)
});
const candidateDraftResponseSchema = z.object({
  drafts: z.array(candidateDraftSchema).max(50)
});
const genericDraftResponseSchema = z.object({
  draft: z.string().min(1)
});

type GenerateCandidateDraftsInput = {
  apiKey: string;
  domain: string;
  text: string;
  candidates: Candidate[];
  signal?: AbortSignal;
};

type GenerateGenericDraftInput = {
  apiKey: string;
  domain: string;
  text: string;
  candidates: Candidate[];
  signal?: AbortSignal;
};

const getCandidateDraftPrompt = (domain: string): string => {
  return [
    `Write short outreach email drafts for candidates at domain ${domain}.`,
    "Return plain text email body only (no markdown, no subject line).",
    "Each draft should be at most 3 short sentences.",
    "Personalize by candidate name and role when available.",
    "If name or role is unknown, keep wording generic and natural.",
    "Do not invent concrete facts that are not in the provided context."
  ].join("\n");
};

const getGenericDraftPrompt = (domain: string): string => {
  return [
    `Write one short outreach email draft for multiple recipients related to domain ${domain}.`,
    "Return plain text email body only (no markdown, no subject line).",
    "The draft must work for a list of recipients (not just one person).",
    "Keep it concise (2-4 short sentences).",
    "Do not invent concrete facts that are not in the provided context."
  ].join("\n");
};

const formatCandidatesForPrompt = (candidates: Candidate[]): string => {
  return JSON.stringify(
    candidates.map((candidate, index) => ({
      index,
      name: candidate.name,
      role: candidate.role,
      email: candidate.email ?? null
    })),
    null,
    2
  );
};

const toSourceSnippet = (text: string): string => {
  return text.slice(0, DRAFT_SOURCE_TEXT_MAX_CHARS);
};

export const generateCandidateDrafts = async ({
  apiKey,
  domain,
  text,
  candidates,
  signal
}: GenerateCandidateDraftsInput): Promise<(string | undefined)[]> => {
  if (candidates.length === 0) {
    return [];
  }

  const modelId = "mistral-small-latest";
  const model = createMistral({ apiKey })(modelId);
  const prompt = getCandidateDraftPrompt(domain);
  const requestPrompt = [
    prompt,
    "",
    "Candidates:",
    formatCandidatesForPrompt(candidates),
    "",
    `Website text:\n${toSourceSnippet(text)}`
  ].join("\n");

  logInfo("mistral:drafts", "sending candidate drafts request", {
    model: modelId,
    domain,
    candidates: candidates.length,
    promptChars: requestPrompt.length,
    promptPreview: previewText(requestPrompt, 1_500)
  });

  try {
    const { object } = await generateObject({
      model,
      schema: candidateDraftResponseSchema,
      prompt: requestPrompt,
      abortSignal: signal
    });

    const draftsByIndex = new Map<number, string>();

    for (const draftItem of object.drafts) {
      if (draftItem.index < 0 || draftItem.index >= candidates.length) {
        continue;
      }

      const normalized = draftItem.draft.trim();

      if (!normalized) {
        continue;
      }

      draftsByIndex.set(draftItem.index, normalized);
    }

    logInfo("mistral:drafts", "received candidate drafts response", {
      requestedCandidates: candidates.length,
      returnedDrafts: draftsByIndex.size
    });

    return candidates.map((_candidate, index) => draftsByIndex.get(index));
  } catch (error) {
    logError("mistral:drafts", "candidate drafts request failed", error);
    throw error;
  }
};

export const generateGenericMultiRecipientDraft = async ({
  apiKey,
  domain,
  text,
  candidates,
  signal
}: GenerateGenericDraftInput): Promise<string | undefined> => {
  if (candidates.length <= 1) {
    return undefined;
  }

  const modelId = "mistral-small-latest";
  const model = createMistral({ apiKey })(modelId);
  const prompt = getGenericDraftPrompt(domain);
  const requestPrompt = [
    prompt,
    "",
    "Recipients:",
    formatCandidatesForPrompt(candidates),
    "",
    `Website text:\n${toSourceSnippet(text)}`
  ].join("\n");

  logInfo("mistral:drafts", "sending generic multi-recipient draft request", {
    model: modelId,
    domain,
    recipients: candidates.length,
    promptChars: requestPrompt.length,
    promptPreview: previewText(requestPrompt, 1_500)
  });

  try {
    const { object } = await generateObject({
      model,
      schema: genericDraftResponseSchema,
      prompt: requestPrompt,
      abortSignal: signal
    });

    const draft = object.draft.trim();

    logInfo("mistral:drafts", "received generic multi-recipient draft response", {
      recipients: candidates.length,
      hasDraft: draft.length > 0
    });

    return draft || undefined;
  } catch (error) {
    logError("mistral:drafts", "generic multi-recipient draft request failed", error);
    throw error;
  }
};
