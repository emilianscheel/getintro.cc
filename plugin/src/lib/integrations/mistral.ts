import type { Candidate } from "../types";
import { retrieveObject } from "../ai/retrieveObject";

export const extractCandidatesWithMistral = async (
  apiKey: string,
  domain: string,
  text: string,
  signal?: AbortSignal
): Promise<Candidate[]> => {
  if (!text.trim()) {
    return [];
  }

  return retrieveObject({
    apiKey,
    domain,
    text,
    signal
  });
};
