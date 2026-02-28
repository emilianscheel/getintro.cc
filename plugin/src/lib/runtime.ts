import type { RuntimeRequest, RuntimeResponse } from "./messages";

export const sendRuntimeMessage = async (
  message: RuntimeRequest
): Promise<RuntimeResponse> => {
  const response = (await chrome.runtime.sendMessage(message)) as
    | RuntimeResponse
    | undefined;

  if (!response) {
    throw new Error("Extension did not return a response.");
  }

  return response;
};
