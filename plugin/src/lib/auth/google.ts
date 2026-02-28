const getAuthToken = async (interactive: boolean): Promise<string> => {
  return await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      const runtimeError = chrome.runtime.lastError;

      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      if (!token) {
        reject(new Error("Google auth did not return a token."));
        return;
      }

      resolve(token);
    });
  });
};

export const removeCachedToken = async (token: string): Promise<void> => {
  await new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
};

const fetchGoogleEmail = async (token: string): Promise<string> => {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Failed to load Google profile.");
  }

  const payload = (await response.json()) as { emailAddress?: string };

  if (!payload.emailAddress) {
    throw new Error("Google profile response did not include an email address.");
  }

  return payload.emailAddress;
};

export const signInWithGoogle = async (): Promise<{ email: string }> => {
  const token = await getAuthToken(true);
  const email = await fetchGoogleEmail(token);
  return { email };
};

export const signOutGoogle = async (): Promise<void> => {
  try {
    const token = await getAuthToken(false);
    await removeCachedToken(token);
  } catch {
    // Ignore if there is no active token.
  }
};

export const getTokenForApi = async (): Promise<string> => {
  try {
    return await getAuthToken(false);
  } catch {
    return getAuthToken(true);
  }
};
