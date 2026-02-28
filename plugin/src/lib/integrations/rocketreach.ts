import type { Candidate } from "../types";

type EnrichInput = {
  apiKey: string;
  domain: string;
  candidates: Candidate[];
  maxCandidates: number;
  deadlineAt: number;
};

const ROCKET_REACH_ENDPOINTS = [
  "https://api.rocketreach.co/v2/api/person/lookup",
  "https://api.rocketreach.co/v2/api/search"
];

const firstEmailInObject = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return value;
    }

    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = firstEmailInObject(item);
      if (result) {
        return result;
      }
    }

    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const [key, nested] of Object.entries(record)) {
      if (key.toLowerCase().includes("email") && typeof nested === "string") {
        const maybe = firstEmailInObject(nested);
        if (maybe) {
          return maybe;
        }
      }
    }

    for (const nested of Object.values(record)) {
      const maybe = firstEmailInObject(nested);
      if (maybe) {
        return maybe;
      }
    }
  }

  return undefined;
};

const fetchRocketReachEmail = async (
  apiKey: string,
  candidateName: string,
  domain: string,
  signal: AbortSignal
): Promise<string | undefined> => {
  for (const endpoint of ROCKET_REACH_ENDPOINTS) {
    const response = await fetch(endpoint, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
        "X-Api-Key": apiKey
      },
      body: JSON.stringify({
        name: candidateName,
        current_employer_domain: domain
      })
    });

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as unknown;
    const email = firstEmailInObject(payload);

    if (email) {
      return email.toLowerCase();
    }
  }

  return undefined;
};

export const enrichCandidatesWithRocketReach = async ({
  apiKey,
  domain,
  candidates,
  maxCandidates,
  deadlineAt
}: EnrichInput): Promise<Candidate[]> => {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected = sorted.slice(0, maxCandidates);

  const enriched: Candidate[] = [];

  for (const candidate of selected) {
    const remaining = deadlineAt - Date.now();

    if (remaining <= 0) {
      enriched.push(candidate);
      continue;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remaining);

    try {
      const email = await fetchRocketReachEmail(
        apiKey,
        candidate.name,
        domain,
        controller.signal
      );

      enriched.push(
        email
          ? {
              ...candidate,
              email,
              source: "rocketreach"
            }
          : candidate
      );
    } catch {
      enriched.push(candidate);
    } finally {
      clearTimeout(timeout);
    }
  }

  const untouched = sorted.slice(maxCandidates);
  return [...enriched, ...untouched];
};
