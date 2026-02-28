import type { ApiProvider } from "../types";
import { decryptSecret, encryptSecret } from "./crypto";
import {
  clearSecretEnvelope,
  getSecretEnvelope,
  setSecretEnvelope
} from "../state/storage";

export const saveEncryptedApiKey = async (
  provider: ApiProvider,
  value: string
): Promise<void> => {
  const envelope = await encryptSecret(value.trim());
  await setSecretEnvelope(provider, envelope);
};

export const loadApiKey = async (
  provider: ApiProvider
): Promise<string | null> => {
  const envelope = await getSecretEnvelope(provider);

  if (!envelope) {
    return null;
  }

  return decryptSecret(envelope);
};

export const clearApiKey = async (provider: ApiProvider): Promise<void> => {
  await clearSecretEnvelope(provider);
};
