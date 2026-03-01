import type {
  ApiProvider,
  CachedDomainPipelinePool,
  EncryptedSecretEnvelope,
  OnboardingState,
  OutreachRecord,
  StoredSecrets
} from "../types";
import { ROCKETREACH_KEY_REQUIRED_FOR_ONBOARDING } from "../integrations/email-enrichment/config";
import { isMistralAvailable } from "../integrations/mistral-config";
import { decryptSecret, encryptSecret } from "../security/crypto";

const STORAGE_KEYS = {
  ONBOARDING_STATE: "onboarding-state",
  SECRETS: "secrets",
  PIPELINE_POOLS: "pipeline-pools",
  PIPELINE_CACHE_EPOCH: "pipeline-cache-epoch",
  OUTREACH_HISTORY: "outreach-history"
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

const isOutreachRecord = (value: unknown): value is OutreachRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OutreachRecord>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAtMs === "number" &&
    (candidate.status === "sent" || candidate.status === "draft") &&
    typeof candidate.hostname === "string" &&
    typeof candidate.toEmail === "string" &&
    Array.isArray(candidate.bccEmails) &&
    candidate.bccEmails.every((email) => typeof email === "string") &&
    typeof candidate.recipientEmail === "string" &&
    typeof candidate.senderEmail === "string" &&
    typeof candidate.subject === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.gmailUrl === "string"
  );
};

const getEncryptedOutreachHistory = async (): Promise<EncryptedSecretEnvelope[]> => {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.OUTREACH_HISTORY);
  const raw = stored[STORAGE_KEYS.OUTREACH_HISTORY];

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(
    (item): item is EncryptedSecretEnvelope =>
      Boolean(item) &&
      typeof item === "object" &&
      (item as EncryptedSecretEnvelope).version === 1 &&
      typeof (item as EncryptedSecretEnvelope).ciphertextB64 === "string" &&
      typeof (item as EncryptedSecretEnvelope).ivB64 === "string"
  );
};

const setEncryptedOutreachHistory = async (
  envelopes: EncryptedSecretEnvelope[]
): Promise<void> => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.OUTREACH_HISTORY]: envelopes
  });
};

export const appendOutreachRecord = async (record: OutreachRecord): Promise<void> => {
  const encrypted = await encryptSecret(JSON.stringify(record));
  const current = await getEncryptedOutreachHistory();
  current.push(encrypted);
  await setEncryptedOutreachHistory(current);
};

const normalizeOutreachRecord = (value: unknown): OutreachRecord | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<OutreachRecord> & {
    toEmail?: unknown;
    bccEmails?: unknown;
    recipientEmail?: unknown;
  };

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.createdAtMs !== "number" ||
    !Number.isFinite(candidate.createdAtMs) ||
    (candidate.status !== "sent" && candidate.status !== "draft") ||
    typeof candidate.hostname !== "string" ||
    typeof candidate.senderEmail !== "string" ||
    typeof candidate.subject !== "string" ||
    typeof candidate.body !== "string" ||
    typeof candidate.gmailUrl !== "string"
  ) {
    return null;
  }

  const toEmail =
    typeof candidate.toEmail === "string" && candidate.toEmail.trim().length > 0
      ? candidate.toEmail.trim()
      : typeof candidate.recipientEmail === "string" && candidate.recipientEmail.trim().length > 0
        ? candidate.recipientEmail.trim()
        : "";

  if (!toEmail) {
    return null;
  }

  const rawBcc = Array.isArray(candidate.bccEmails) ? candidate.bccEmails : [];
  const bccEmails = rawBcc
    .filter((email): email is string => typeof email === "string")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  const normalizeOptional = (field: unknown): string | undefined => {
    if (typeof field !== "string") {
      return undefined;
    }

    const trimmed = field.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  return {
    id: candidate.id,
    createdAtMs: Math.floor(candidate.createdAtMs),
    status: candidate.status,
    hostname: candidate.hostname,
    toEmail,
    bccEmails,
    recipientEmail:
      typeof candidate.recipientEmail === "string" && candidate.recipientEmail.trim().length > 0
        ? candidate.recipientEmail.trim()
        : toEmail,
    senderEmail: candidate.senderEmail,
    subject: candidate.subject,
    body: candidate.body,
    gmailUrl: candidate.gmailUrl,
    gmailDraftId: normalizeOptional(candidate.gmailDraftId),
    gmailMessageId: normalizeOptional(candidate.gmailMessageId),
    gmailThreadId: normalizeOptional(candidate.gmailThreadId)
  };
};

export const getOutreachHistory = async (): Promise<OutreachRecord[]> => {
  const envelopes = await getEncryptedOutreachHistory();
  const records: OutreachRecord[] = [];

  for (const envelope of envelopes) {
    try {
      const decrypted = await decryptSecret(envelope);
      const parsed = JSON.parse(decrypted) as unknown;
      const normalized = normalizeOutreachRecord(parsed);

      if (!normalized) {
        console.error("[getintro.cc][storage] invalid outreach record payload");
        continue;
      }

      records.push(normalized);
    } catch (error) {
      console.error("[getintro.cc][storage] failed to decrypt outreach record", error);
    }
  }

  return records.sort((a, b) => b.createdAtMs - a.createdAtMs);
};

export const setOutreachHistory = async (records: OutreachRecord[]): Promise<void> => {
  const envelopes: EncryptedSecretEnvelope[] = [];

  for (const record of records) {
    if (!isOutreachRecord(record)) {
      continue;
    }

    const encrypted = await encryptSecret(JSON.stringify(record));
    envelopes.push(encrypted);
  }

  await setEncryptedOutreachHistory(envelopes);
};
