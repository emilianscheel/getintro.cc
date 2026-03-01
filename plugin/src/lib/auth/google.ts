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

type GoogleUserInfoPayload = {
  email?: string;
  name?: string;
};

type GmailProfilePayload = {
  emailAddress?: string;
};

const parseGoogleUserInfo = (payload: GoogleUserInfoPayload): {
  email?: string;
  name?: string;
} => {
  const email = payload.email?.trim();
  const name = payload.name?.trim();

  return {
    email: email && email.length > 0 ? email : undefined,
    name: name && name.length > 0 ? name : undefined
  };
};

const fetchGoogleUserInfo = async (
  token: string
): Promise<{ email?: string; name?: string }> => {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Failed to load Google user info.");
  }

  const payload = (await response.json()) as GoogleUserInfoPayload;
  return parseGoogleUserInfo(payload);
};

const fetchGoogleEmailFromGmailProfile = async (token: string): Promise<string> => {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Failed to load Google profile.");
  }

  const payload = (await response.json()) as GmailProfilePayload;

  if (!payload.emailAddress) {
    throw new Error("Google profile response did not include an email address.");
  }

  return payload.emailAddress;
};

export const signInWithGoogle = async (): Promise<{ email: string; name?: string }> => {
  const token = await getAuthToken(true);
  let profile: { email?: string; name?: string };

  try {
    profile = await fetchGoogleUserInfo(token);
  } catch {
    profile = {};
  }

  const email = profile.email ?? (await fetchGoogleEmailFromGmailProfile(token));
  return { email, name: profile.name };
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
