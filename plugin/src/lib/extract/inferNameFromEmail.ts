const GENERIC_LOCAL_PARTS = new Set([
  "info",
  "contact",
  "hello",
  "support",
  "team",
  "office",
  "sales",
  "admin",
  "jobs",
  "career",
  "careers",
  "hr",
  "mail"
]);

const normalizeToken = (token: string): string => {
  return token.trim().replace(/[^a-z]/gi, "");
};

const toTitleCase = (value: string): string => {
  if (!value) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1).toLowerCase();
};

const tokenize = (raw: string): string[] => {
  return raw
    .split(/[\s._+-]+/)
    .map(normalizeToken)
    .filter(Boolean);
};

const inferFromLocalPart = (localPart: string): string | undefined => {
  const normalizedLocalPart = localPart.trim().toLowerCase();

  if (!normalizedLocalPart || GENERIC_LOCAL_PARTS.has(normalizedLocalPart)) {
    return undefined;
  }

  const tokens = tokenize(localPart);

  if (tokens.length === 0) {
    return undefined;
  }

  return tokens.map(toTitleCase).join(" ");
};

const inferRegistrableLabel = (domain: string): string | undefined => {
  const labels = domain
    .trim()
    .toLowerCase()
    .split(".")
    .map((label) => label.trim())
    .filter(Boolean);

  if (labels.length === 0) {
    return undefined;
  }

  if (labels.length >= 3) {
    const secondLevel = labels[labels.length - 2];

    // Handle common ccTLD patterns like example.co.uk or example.com.au.
    if (secondLevel.length <= 3) {
      return labels[labels.length - 3];
    }
  }

  if (labels.length >= 2) {
    return labels[labels.length - 2];
  }

  return labels[0];
};

const inferFromDomain = (domain: string): string | undefined => {
  const registrableLabel = inferRegistrableLabel(domain);

  if (!registrableLabel) {
    return undefined;
  }

  const tokens = tokenize(registrableLabel);

  if (tokens.length < 2) {
    return undefined;
  }

  return tokens.map(toTitleCase).join(" ");
};

export const inferNameFromEmailAddress = (email: string): string | undefined => {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf("@");

  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return undefined;
  }

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);

  return inferFromLocalPart(localPart) ?? inferFromDomain(domain);
};
