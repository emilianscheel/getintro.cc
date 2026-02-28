export type EmailEnrichmentProviderId = "mock" | "rocketreach";

const KNOWN_PROVIDERS: EmailEnrichmentProviderId[] = ["mock", "rocketreach"];
const DEFAULT_PROVIDER_CHAIN = "mock,rocketreach";

const parseProviderChain = (raw: string): EmailEnrichmentProviderId[] => {
  const normalized = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((value): value is EmailEnrichmentProviderId =>
      KNOWN_PROVIDERS.includes(value as EmailEnrichmentProviderId)
    );

  return Array.from(new Set(normalized));
};

const configuredChain =
  typeof __EMAIL_LOOKUP_PROVIDER_CHAIN__ !== "undefined"
    ? __EMAIL_LOOKUP_PROVIDER_CHAIN__
    : DEFAULT_PROVIDER_CHAIN;

export const EMAIL_ENRICHMENT_PROVIDER_CHAIN = (() => {
  const parsed = parseProviderChain(configuredChain);
  return parsed.length > 0 ? parsed : parseProviderChain(DEFAULT_PROVIDER_CHAIN);
})();

export const ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING =
  EMAIL_ENRICHMENT_PROVIDER_CHAIN.length === 1 &&
  EMAIL_ENRICHMENT_PROVIDER_CHAIN[0] === "rocketreach";
