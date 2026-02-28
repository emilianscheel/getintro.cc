import type { EmailEnrichmentProviderId } from "./config";

export type EmailLookupInput = {
  name: string;
  domain: string;
  role: string;
  signal: AbortSignal;
  apiKey?: string;
};

export type EmailLookupProvider = {
  id: EmailEnrichmentProviderId;
  requiresApiKey: boolean;
  lookupEmails: (input: EmailLookupInput) => Promise<string[]>;
};
