const PRELOADED_MISTRAL_API_KEY_VALUE =
  typeof __MISTRAL_API_KEY__ === "string" ? __MISTRAL_API_KEY__.trim() : "";

export const PRELOADED_MISTRAL_API_KEY =
  PRELOADED_MISTRAL_API_KEY_VALUE.length > 0
    ? PRELOADED_MISTRAL_API_KEY_VALUE
    : null;

export const hasPreloadedMistralApiKey = PRELOADED_MISTRAL_API_KEY !== null;

export const isMistralAvailable = (mistralKeySet: boolean): boolean => {
  return mistralKeySet || hasPreloadedMistralApiKey;
};
