import type { DraftAndSendRequest } from "../types";
import { getTokenForApi, removeCachedToken } from "../auth/google";

const base64UrlEncode = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const buildRawMessage = (request: DraftAndSendRequest): string => {
  const lines = [
    `From: ${request.fromEmail}`,
    `To: ${request.toEmail}`,
    `Subject: ${request.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
    "",
    request.message
  ];

  return base64UrlEncode(lines.join("\r\n"));
};

const gmailRequest = async <T>(
  token: string,
  endpoint: string,
  init: RequestInit
): Promise<T> => {
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (response.status === 401) {
    await removeCachedToken(token);
    throw new Error("Google auth expired. Please try again.");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${errorBody}`);
  }

  return (await response.json()) as T;
};

export const createDraftAndSend = async (
  payload: DraftAndSendRequest
): Promise<{ draftId: string; messageId: string }> => {
  const token = await getTokenForApi();
  const raw = buildRawMessage(payload);

  const draft = await gmailRequest<{ id: string }>(
    token,
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      body: JSON.stringify({
        message: {
          raw
        }
      })
    }
  );

  const sent = await gmailRequest<{ id: string }>(
    token,
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts/send",
    {
      method: "POST",
      body: JSON.stringify({
        id: draft.id
      })
    }
  );

  return {
    draftId: draft.id,
    messageId: sent.id
  };
};
