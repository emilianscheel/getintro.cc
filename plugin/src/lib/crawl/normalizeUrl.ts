export const normalizeUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    parsed.hash = "";

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

export const isSameHostname = (baseUrl: string, candidateUrl: string): boolean => {
  try {
    return new URL(baseUrl).hostname === new URL(candidateUrl).hostname;
  } catch {
    return false;
  }
};
