import type { Candidate, RegexEmailDisplayContext } from "../types";
import {
  retrieveObject,
  retrieveRegexEmailDisplayCandidates
} from "../ai/retrieveObject";
import {
  generateCandidateDrafts,
  generateGenericMultiRecipientDraft,
  type EmailDraft
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
  regexEmailContexts: RegexEmailDisplayContext[],
  signal?: AbortSignal
): Promise<Candidate[]> => {
  if (regexEmailContexts.length === 0) {
    return [];
  }

  return retrieveRegexEmailDisplayCandidates({
    apiKey,
    domain,
    regexEmailContexts,
    signal
  });
};

export const generateCandidateEmailDraftsWithMistral = async (
  apiKey: string,
  domain: string,
  text: string,
  candidates: Candidate[],
  senderName?: string,
  senderEmail?: string,
  customDraftPrompt?: string,
  signal?: AbortSignal
): Promise<(EmailDraft | undefined)[]> => {
  return generateCandidateDrafts({
    apiKey,
    domain,
    text,
    candidates,
    senderName,
    senderEmail,
    customDraftPrompt,
    signal
  });
};

export const generateGenericMultiRecipientEmailDraftWithMistral = async (
  apiKey: string,
  domain: string,
  text: string,
  candidates: Candidate[],
  senderName?: string,
  senderEmail?: string,
  customDraftPrompt?: string,
  signal?: AbortSignal
): Promise<EmailDraft | undefined> => {
  return generateGenericMultiRecipientDraft({
    apiKey,
    domain,
    text,
    candidates,
    senderName,
    senderEmail,
    customDraftPrompt,
    signal
  });
};
