import type {
  ApiProvider,
  EncryptedSecretEnvelope,
  OnboardingState,
  StoredSecrets
} from "../types";
import { ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING } from "../integrations/email-enrichment/config";
import { isMistralAvailable } from "../integrations/mistral-config";

const STORAGE_KEYS = {
  ONBOARDING_STATE: "onboarding-state",
  SECRETS: "secrets"
} as const;

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  started: false,
  googleConnected: false,
  googleEmail: undefined,
  mistralKeySet: false,
  rocketreachKeySet: false,
  completed: false
};

const deriveCompleted = (state: OnboardingState): OnboardingState => {
  const mistralAvailable = isMistralAvailable(state.mistralKeySet);

  return {
    ...state,
    completed: ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING
      ? state.googleConnected && mistralAvailable && state.rocketreachKeySet
      : state.googleConnected && mistralAvailable
  };
};

export const getOnboardingState = async (): Promise<OnboardingState> => {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.ONBOARDING_STATE);
  const state = stored[STORAGE_KEYS.ONBOARDING_STATE] as
    | Partial<OnboardingState>
    | undefined;

  if (!state) {
    return DEFAULT_ONBOARDING_STATE;
  }

  return deriveCompleted({
    ...DEFAULT_ONBOARDING_STATE,
    ...state
  });
};

export const patchOnboardingState = async (
  patch: Partial<OnboardingState>
): Promise<OnboardingState> => {
  const current = await getOnboardingState();
  const next = deriveCompleted({
    ...current,
    ...patch
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.ONBOARDING_STATE]: next
  });

  return next;
};

const getSecrets = async (): Promise<StoredSecrets> => {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.SECRETS);
  return (stored[STORAGE_KEYS.SECRETS] as StoredSecrets | undefined) ?? {};
};

const setSecrets = async (secrets: StoredSecrets): Promise<void> => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SECRETS]: secrets
  });
};

export const getSecretEnvelope = async (
  provider: ApiProvider
): Promise<EncryptedSecretEnvelope | null> => {
  const secrets = await getSecrets();
  return secrets[provider] ?? null;
};

export const setSecretEnvelope = async (
  provider: ApiProvider,
  envelope: EncryptedSecretEnvelope
): Promise<void> => {
  const secrets = await getSecrets();
  secrets[provider] = envelope;
  await setSecrets(secrets);
};

export const clearSecretEnvelope = async (provider: ApiProvider): Promise<void> => {
  const secrets = await getSecrets();
  delete secrets[provider];
  await setSecrets(secrets);
};
