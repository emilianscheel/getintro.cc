import type { Candidate } from "../lib/types";
import { candidatePoolKey } from "../lib/state/pipelinePool";

export const appendUnseenCandidates = (
  currentCandidates: Candidate[],
  nextCandidates: Candidate[]
): { candidates: Candidate[]; addedCount: number } => {
  const seen = new Set(currentCandidates.map(candidatePoolKey));
  const additions: Candidate[] = [];

  for (const candidate of nextCandidates) {
    const key = candidatePoolKey(candidate);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    additions.push(candidate);
  }

  if (additions.length === 0) {
    return {
      candidates: currentCandidates,
      addedCount: 0
    };
  }

  return {
    candidates: [...currentCandidates, ...additions],
    addedCount: additions.length
  };
};
