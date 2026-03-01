export const getHttpHostnameFromUrl = (url: string | undefined): string | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }

    return parsed.hostname;
  } catch {
    return undefined;
  }
};

export const shouldPersistPipelinePoolForEpoch = (
  runEpoch: number,
  currentEpoch: number
): boolean => {
  return runEpoch === currentEpoch;
};
