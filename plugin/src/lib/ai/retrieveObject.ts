import { createMistral } from "@ai-sdk/mistral";
import { generateObject } from "ai";
import { z } from "zod";
import type { Candidate } from "../types";

const candidateSchema = z.object({
  name: z.string().min(1),
  score: z.number(),
  role: z.string().min(1)
});

const responseSchema = z.object({
  candidates: z.array(candidateSchema).max(25)
});

type RetrieveObjectInput = {
  apiKey: string;
  domain: string;
  text: string;
  signal?: AbortSignal;
};

const clampScore = (score: number): number => {
  if (Number.isNaN(score)) {
    return 0;
  }

  return Math.min(1, Math.max(0, score));
};

export const retrieveObject = async ({
  apiKey,
  domain,
  text,
  signal
}: RetrieveObjectInput): Promise<Candidate[]> => {
  const model = createMistral({ apiKey })("mistral-small-latest");

  const prompt = [
    `Analyze the following company website text for domain ${domain}.`,
    "Return candidate people that could be relevant outreach targets.",
    "Output name, role and a confidence score between 0 and 1.",
    "Prefer co-founders, C-level, and leadership roles.",
    "If uncertain, still return best guesses with lower score."
  ].join("\n");

  const { object } = await generateObject({
    model,
    schema: responseSchema,
    prompt: `${prompt}\n\nWebsite text:\n${text.slice(0, 80_000)}`,
    abortSignal: signal
  });

  return object.candidates.map((candidate) => ({
    name: candidate.name.trim(),
    role: candidate.role.trim(),
    score: clampScore(candidate.score),
    source: "mistral"
  }));
};
