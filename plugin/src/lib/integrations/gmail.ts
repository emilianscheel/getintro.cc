import type { DraftAndSendRequest } from "../types";
import { getTokenForApi, removeCachedToken } from "../auth/google";
import { elapsedMs, logError, logInfo, previewText } from "../logging";

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
  const requestStartedAt = Date.now();
  logInfo("gmail:api", "sending request", {
    endpoint,
    method: init.method ?? "GET",
    bodyLength: typeof init.body === "string" ? init.body.length : null
  });

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
    logError("gmail:api", "request rejected because auth expired", {
      endpoint,
      status: response.status,
      elapsedMs: elapsedMs(requestStartedAt)
    });
    throw new Error("Google auth expired. Please try again.");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    logError("gmail:api", "request failed", {
      endpoint,
      status: response.status,
      elapsedMs: elapsedMs(requestStartedAt),
      errorBody
    });
    throw new Error(`Gmail API error (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as T;
  logInfo("gmail:api", "received response", {
    endpoint,
    status: response.status,
    elapsedMs: elapsedMs(requestStartedAt),
    payload
  });

  return payload;
};

export const createDraftAndSend = async (
  payload: DraftAndSendRequest
): Promise<{ draftId: string; messageId: string }> => {
  logInfo("gmail", "createDraftAndSend started", {
    fromEmail: payload.fromEmail,
    toEmail: payload.toEmail,
    subject: payload.subject,
    messageLength: payload.message.length,
    messagePreview: previewText(payload.message, 200)
  });
  const token = await getTokenForApi();
  const raw = buildRawMessage(payload);
  logInfo("gmail", "encoded draft message", { rawLength: raw.length });

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
  logInfo("gmail", "draft created", { draftId: draft.id });

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
  logInfo("gmail", "draft sent", { draftId: draft.id, messageId: sent.id });

  return {
    draftId: draft.id,
    messageId: sent.id
  };
};
