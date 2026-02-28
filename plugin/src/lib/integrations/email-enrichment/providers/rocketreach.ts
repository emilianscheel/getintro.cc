import type { EmailLookupProvider } from "../types";

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

export const rocketReachEmailLookupProvider: EmailLookupProvider = {
  id: "rocketreach",
  requiresApiKey: true,
  lookupEmails: async ({ name, domain, apiKey, signal }) => {
    if (!apiKey) {
      return [];
    }

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
          name,
          current_employer_domain: domain
        })
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as unknown;
      const email = firstEmailInObject(payload);

      if (email) {
        return [email.toLowerCase()];
      }
    }

    return [];
  }
};
