export type OnboardingStep = "google" | "mistral" | "rocketreach";
export type ApiProvider = "mistral" | "rocketreach";

export type OnboardingState = {
  started: boolean;
  googleConnected: boolean;
  googleEmail?: string;
  mistralKeySet: boolean;
  rocketreachKeySet: boolean;
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

export type PipelineResult = {
  domain: string;
  visitedUrls: string[];
  emailsRegex: string[];
  candidates: Candidate[];
  multiRecipientDraft?: string;
  partial: boolean;
  stoppedAtMs: number;
};

export type DraftAndSendRequest = {
  fromEmail: string;
  toEmail: string;
  subject: string;
  message: string;
};
