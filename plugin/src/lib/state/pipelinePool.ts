import type { CachedDomainPipelinePool, Candidate, PipelineResult } from "../types";

const normalize = (value: string | undefined): string => value?.trim().toLowerCase() ?? "";

export const candidatePoolKey = (candidate: Candidate): string => {
  const email = normalize(candidate.email);

  if (email) {
    return `email:${email}`;
  }

  return `nameRole:${normalize(candidate.name)}|${normalize(candidate.role)}`;
};

const mergeUniqueStrings = (left: string[], right: string[]): string[] => {
  return Array.from(new Set([...left, ...right]));
};

export const mergePipelineResultIntoPool = (
  existingPool: CachedDomainPipelinePool | undefined,
  freshResult: PipelineResult
): CachedDomainPipelinePool => {
  const existingCandidates = existingPool?.candidates ?? [];
  const candidateKeys = new Set(existingCandidates.map(candidatePoolKey));
  const mergedCandidates = [...existingCandidates];

  for (const candidate of freshResult.candidates) {
    const key = candidatePoolKey(candidate);

    if (candidateKeys.has(key)) {
      continue;
    }

    candidateKeys.add(key);
    mergedCandidates.push(candidate);
  }

  return {
    domain: freshResult.domain,
    visitedUrls: mergeUniqueStrings(existingPool?.visitedUrls ?? [], freshResult.visitedUrls),
    emailsRegex: mergeUniqueStrings(existingPool?.emailsRegex ?? [], freshResult.emailsRegex),
    candidates: mergedCandidates,
    multiRecipientDraft:
      (freshResult.multiRecipientDraft?.trim() || undefined) ??
      existingPool?.multiRecipientDraft,
    updatedAtMs: Date.now()
  };
};
