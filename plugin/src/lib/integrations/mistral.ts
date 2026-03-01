import type { Candidate } from "../types";
import {
  retrieveObject,
  retrieveRegexEmailDisplayCandidates
} from "../ai/retrieveObject";
import {
  generateCandidateDrafts,
  generateGenericMultiRecipientDraft
} from "../ai/generateDrafts";

export const extractCandidatesWithMistral = async (
  apiKey: string,
  domain: string,
  text: string,
  regexEmails: string[],
  signal?: AbortSignal
): Promise<Candidate[]> => {
  if (!text.trim() && regexEmails.length === 0) {
    return [];
  }

  return retrieveObject({
    apiKey,
    domain,
    text,
    regexEmails,
    signal
  });
};

export const retrieveRegexEmailDisplayCandidatesWithMistral = async (
  apiKey: string,
  domain: string,
  regexEmails: string[],
  signal?: AbortSignal
): Promise<Candidate[]> => {
  if (regexEmails.length === 0) {
    return [];
  }

  return retrieveRegexEmailDisplayCandidates({
    apiKey,
    domain,
    regexEmails,
    signal
  });
};

export const generateCandidateEmailDraftsWithMistral = async (
  apiKey: string,
  domain: string,
  text: string,
  candidates: Candidate[],
  signal?: AbortSignal
): Promise<(string | undefined)[]> => {
  return generateCandidateDrafts({
    apiKey,
    domain,
    text,
    candidates,
    signal
  });
};

export const generateGenericMultiRecipientEmailDraftWithMistral = async (
  apiKey: string,
  domain: string,
  text: string,
  candidates: Candidate[],
  signal?: AbortSignal
): Promise<string | undefined> => {
  return generateGenericMultiRecipientDraft({
    apiKey,
    domain,
    text,
    candidates,
    signal
  });
};
