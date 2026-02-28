const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export const extractEmails = (text: string): string[] => {
  const matches = text.match(EMAIL_REGEX) ?? [];
  return Array.from(
    new Set(matches.map((value) => value.trim().toLowerCase()))
  );
};
