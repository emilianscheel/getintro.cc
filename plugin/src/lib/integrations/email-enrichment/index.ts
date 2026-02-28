import type { Candidate } from "../../types";
import {
  EMAIL_ENRICHMENT_PROVIDER_CHAIN,
  type EmailEnrichmentProviderId
} from "./config";
import type { EmailLookupProvider } from "./types";
import { mockEmailLookupProvider } from "./providers/mock";
import { rocketReachEmailLookupProvider } from "./providers/rocketreach";

type EnrichCandidatesInput = {
  domain: string;
  candidates: Candidate[];
  maxCandidates: number;
  deadlineAt: number;
  apiKeys: {
    rocketreach?: string | null;
  };
};

const PROVIDERS: Record<EmailEnrichmentProviderId, EmailLookupProvider> = {
  mock: mockEmailLookupProvider,
  rocketreach: rocketReachEmailLookupProvider
};

const providerToCandidateSource = (
  providerId: EmailEnrichmentProviderId
): Candidate["source"] => {
  if (providerId === "rocketreach") {
    return "rocketreach";
  }

  return "mock";
};

const getApiKeyForProvider = (
  providerId: EmailEnrichmentProviderId,
  apiKeys: EnrichCandidatesInput["apiKeys"]
): string | undefined => {
  if (providerId === "rocketreach") {
    return apiKeys.rocketreach ?? undefined;
  }

  return undefined;
};

const withCandidateLookupDeadline = async <T>(
  deadlineAt: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const remaining = deadlineAt - Date.now();

  if (remaining <= 0) {
    throw new Error("Email lookup deadline reached.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remaining);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

export const enrichCandidatesWithEmailProviders = async ({
  domain,
  candidates,
  maxCandidates,
  deadlineAt,
  apiKeys
}: EnrichCandidatesInput): Promise<Candidate[]> => {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected = sorted.slice(0, maxCandidates);

  const enriched: Candidate[] = [];

  for (const candidate of selected) {
    if (Date.now() >= deadlineAt) {
      enriched.push(candidate);
      continue;
    }

    let finalCandidate = candidate;

    for (const providerId of EMAIL_ENRICHMENT_PROVIDER_CHAIN) {
      const provider = PROVIDERS[providerId];
      const apiKey = getApiKeyForProvider(providerId, apiKeys);

      if (provider.requiresApiKey && !apiKey) {
        continue;
      }

      try {
        const emails = await withCandidateLookupDeadline(deadlineAt, (signal) =>
          provider.lookupEmails({
            name: candidate.name,
            role: candidate.role,
            domain,
            signal,
            apiKey
          })
        );

        const firstEmail = emails[0]?.trim().toLowerCase();

        if (firstEmail) {
          finalCandidate = {
            ...candidate,
            email: firstEmail,
            source: providerToCandidateSource(providerId)
          };
          break;
        }
      } catch {
        // Silently continue with next provider or fallback candidate.
      }
    }

    enriched.push(finalCandidate);
  }

  return [...enriched, ...sorted.slice(maxCandidates)];
};
