import type { Candidate } from "../../types";
import {
  EMAIL_ENRICHMENT_PROVIDER_CHAIN,
  type EmailEnrichmentProviderId
} from "./config";
import type { EmailLookupProvider } from "./types";
import { mockEmailLookupProvider } from "./providers/mock";
import { rocketReachEmailLookupProvider } from "./providers/rocketreach";
import { elapsedMs, logError, logInfo } from "../../logging";

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
  const startedAt = Date.now();
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected = sorted.slice(0, maxCandidates);
  logInfo("enrichment", "starting provider chain", {
    domain,
    candidateCount: candidates.length,
    selectedCount: selected.length,
    maxCandidates,
    providerChain: EMAIL_ENRICHMENT_PROVIDER_CHAIN
  });

  const enriched: Candidate[] = [];

  for (const candidate of selected) {
    if (Date.now() >= deadlineAt) {
      logInfo("enrichment", "deadline reached before candidate lookup", {
        candidate: candidate.name
      });
      enriched.push(candidate);
      continue;
    }

    let finalCandidate = candidate;
    logInfo("enrichment", "candidate lookup started", {
      candidate: candidate.name,
      role: candidate.role,
      hasEmail: Boolean(candidate.email)
    });

    for (const providerId of EMAIL_ENRICHMENT_PROVIDER_CHAIN) {
      const provider = PROVIDERS[providerId];
      const apiKey = getApiKeyForProvider(providerId, apiKeys);

      if (provider.requiresApiKey && !apiKey) {
        logInfo("enrichment", "provider skipped because API key is missing", {
          providerId,
          candidate: candidate.name
        });
        continue;
      }

      const providerStartedAt = Date.now();
      logInfo("enrichment", "provider request", {
        providerId,
        candidate: candidate.name,
        role: candidate.role,
        domain,
        hasApiKey: Boolean(apiKey)
      });

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
        logInfo("enrichment", "provider response", {
          providerId,
          candidate: candidate.name,
          elapsedMs: elapsedMs(providerStartedAt),
          emails
        });

        const firstEmail = emails[0]?.trim().toLowerCase();

        if (firstEmail) {
          finalCandidate = {
            ...candidate,
            email: firstEmail,
            source: providerToCandidateSource(providerId)
          };
          logInfo("enrichment", "candidate enriched", {
            providerId,
            candidate: candidate.name,
            email: firstEmail
          });
          break;
        }
      } catch (error) {
        logError("enrichment", "provider request failed", {
          providerId,
          candidate: candidate.name,
          error
        });
      }
    }

    enriched.push(finalCandidate);
  }
  const result = [...enriched, ...sorted.slice(maxCandidates)];
  logInfo("enrichment", "completed provider chain", {
    elapsedMs: elapsedMs(startedAt),
    totalCandidates: result.length,
    candidatesWithEmail: result.filter((candidate) => Boolean(candidate.email)).length
  });
  return result;
};
