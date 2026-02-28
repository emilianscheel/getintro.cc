import type { EmailLookupProvider } from "../types";
import { elapsedMs, logError, logInfo } from "../../../logging";

const ROCKET_REACH_ENDPOINTS = [
  "https://api.rocketreach.co/v2/api/person/lookup",
  "https://api.rocketreach.co/v2/api/search"
];

const parseJsonOrText = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

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
      logInfo("rocketreach", "lookup skipped because API key is missing", {
        name,
        domain
      });
      return [];
    }

    for (const endpoint of ROCKET_REACH_ENDPOINTS) {
      const requestBody = {
        name,
        current_employer_domain: domain
      };
      const requestStartedAt = Date.now();
      logInfo("rocketreach", "sending request", {
        endpoint,
        body: requestBody,
        hasApiKey: true
      });

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            "Api-Key": apiKey,
            "X-Api-Key": apiKey
          },
          body: JSON.stringify(requestBody)
        });
      } catch (error) {
        logError("rocketreach", "request failed", {
          endpoint,
          body: requestBody,
          elapsedMs: elapsedMs(requestStartedAt),
          error
        });
        continue;
      }

      const rawPayload = await response.text();
      const payload = parseJsonOrText(rawPayload);
      logInfo("rocketreach", "received response", {
        endpoint,
        status: response.status,
        ok: response.ok,
        elapsedMs: elapsedMs(requestStartedAt),
        payload
      });

      if (!response.ok) {
        continue;
      }

      const email = firstEmailInObject(payload);

      if (email) {
        logInfo("rocketreach", "email extracted from response", {
          endpoint,
          email: email.toLowerCase()
        });
        return [email.toLowerCase()];
      }
    }

    logInfo("rocketreach", "no email found for candidate", { name, domain });
    return [];
  }
};
