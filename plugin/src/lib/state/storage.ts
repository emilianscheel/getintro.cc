import type {
  ApiProvider,
  CachedDomainPipelinePool,
  EncryptedSecretEnvelope,
  OnboardingState,
  StoredSecrets
} from "../types";
import { ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING } from "../integrations/email-enrichment/config";
import { isMistralAvailable } from "../integrations/mistral-config";

const STORAGE_KEYS = {
  ONBOARDING_STATE: "onboarding-state",
  SECRETS: "secrets",
  PIPELINE_POOLS: "pipeline-pools",
  PIPELINE_CACHE_EPOCH: "pipeline-cache-epoch"
} as const;

export const PIPELINE_POOLS_STORAGE_KEY = STORAGE_KEYS.PIPELINE_POOLS;

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  started: false,
  googleConnected: false,
  googleName: undefined,
  googleEmail: undefined,
  mistralKeySet: false,
  rocketreachKeySet: false,
  customDraftPrompt: undefined,
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

type StoredPipelinePools = Record<string, CachedDomainPipelinePool>;

const normalizePipelineCacheEpoch = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
};

export const getPipelinePools = async (): Promise<StoredPipelinePools> => {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.PIPELINE_POOLS);
  return (stored[STORAGE_KEYS.PIPELINE_POOLS] as StoredPipelinePools | undefined) ?? {};
};

export const getPipelinePool = async (
  domain: string
): Promise<CachedDomainPipelinePool | undefined> => {
  const pools = await getPipelinePools();
  return pools[domain];
};

export const setPipelinePool = async (
  domain: string,
  pool: CachedDomainPipelinePool
): Promise<void> => {
  const pools = await getPipelinePools();
  pools[domain] = pool;
  await chrome.storage.local.set({
    [STORAGE_KEYS.PIPELINE_POOLS]: pools
  });
};

export const getPipelineCacheEpoch = async (): Promise<number> => {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.PIPELINE_CACHE_EPOCH);
  return normalizePipelineCacheEpoch(stored[STORAGE_KEYS.PIPELINE_CACHE_EPOCH]);
};

const writePipelinePoolsWithEpochBump = async (pools: StoredPipelinePools): Promise<number> => {
  const nextEpoch = (await getPipelineCacheEpoch()) + 1;
  await chrome.storage.local.set({
    [STORAGE_KEYS.PIPELINE_POOLS]: pools,
    [STORAGE_KEYS.PIPELINE_CACHE_EPOCH]: nextEpoch
  });
  return nextEpoch;
};

export const clearPipelinePool = async (domain: string): Promise<number> => {
  const pools = await getPipelinePools();
  delete pools[domain];
  return writePipelinePoolsWithEpochBump(pools);
};

export const clearAllPipelinePools = async (): Promise<number> => {
  return writePipelinePoolsWithEpochBump({});
};
