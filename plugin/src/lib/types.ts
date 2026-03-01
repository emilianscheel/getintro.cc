export type OnboardingStep = "google" | "mistral" | "rocketreach" | "customPrompt";
export type ApiProvider = "mistral" | "rocketreach";

export type OnboardingState = {
  started: boolean;
  googleConnected: boolean;
  googleName?: string;
  googleEmail?: string;
  mistralKeySet: boolean;
  rocketreachKeySet: boolean;
  customDraftPrompt?: string;
  completed: boolean;
};

export type EncryptedSecretEnvelope = {
  ciphertextB64: string;
  ivB64: string;
  version: 1;
};

export type StoredSecrets = {
  mistral?: EncryptedSecretEnvelope;
  rocketreach?: EncryptedSecretEnvelope;
};

export type CrawlPage = {
  url: string;
  depth: 0 | 1 | 2;
  rawHtml: string;
  strippedText: string;
  emailsFound: string[];
};

export type Candidate = {
  name: string;
  score: number;
  role: string;
  email?: string;
  draft?: string;
  source: "mistral" | "rocketreach" | "mock" | "regex";
};

export type PipelineRunMode = "cache_then_refresh" | "fresh_only";

export type PipelineResult = {
  domain: string;
  visitedUrls: string[];
  emailsRegex: string[];
  candidates: Candidate[];
  multiRecipientDraft?: string;
  partial: boolean;
  stoppedAtMs: number;
  servedFromCache?: boolean;
  backgroundRefreshStarted?: boolean;
};

export type DraftAndSendRequest = {
  fromEmail: string;
  toEmail: string;
  subject: string;
  message: string;
};

export type RegexEmailDisplayContext = {
  email: string;
  sourceUrl?: string;
  sourcePageText?: string;
};

export type CachedDomainPipelinePool = {
  domain: string;
  visitedUrls: string[];
  emailsRegex: string[];
  candidates: Candidate[];
  multiRecipientDraft?: string;
  updatedAtMs: number;
};
