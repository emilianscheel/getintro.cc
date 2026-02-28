# getintro.cc Chrome Extension (`plugin/`)

## Stack

- WXT (Chrome MV3)
- React
- shadcn-style UI components + Tailwind CSS
- Bun package manager

## What is implemented

- Popup onboarding flow:
  - Hello screen (`getintro.cc` + `Get started`)
  - Step 1: Google sign-in
  - Step 2: Mistral API key
  - Step 3: RocketReach API key
- Shader background on every popup screen with white rounded card overlay
- Isolated background pipeline:
  - Runs in service worker only
  - One-shot page read via `chrome.scripting.executeScript` (no persistent content scripts)
  - Same-host crawl depth 2, dedupe, max 25 pages
  - HTML stripping + strict email regex extraction
  - Mistral candidate extraction via local `retrieveObject` wrapper (Vercel AI SDK object generation)
  - RocketReach enrichment (top 8)
- Gmail draft + send flow
  - Logs outbound payload first (`console.log`) for debugging

## Security model

- API keys are encrypted with AES-GCM before storage in `chrome.storage.local`
- AES key is kept in extension-owned IndexedDB
- Decryption happens only in background worker right before API calls
- Popup receives only status flags (never plaintext keys)

## Setup

1. `cd plugin`
2. `bun install`
3. Create `.env.local` from `.env.example` and set:
   - `GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com`
4. `bun run dev` (or `bun run build`)
5. Load output as unpacked extension in Chrome

## Fix Google sign-in error ("This browser or app may not be secure")

Use a **Chrome Extension OAuth client** (not Web/desktop client) and configure consent:

1. In Google Cloud Console, create/select your project.
2. Enable **Gmail API**.
3. Configure **OAuth consent screen**:
   - User type: External (or Internal for Workspace-only)
   - Add required scopes:
     - `openid`
     - `email`
     - `profile`
     - `https://www.googleapis.com/auth/gmail.compose`
   - Add your Google account under **Test users** while app is in testing mode.
4. Create OAuth Client ID:
   - Application type: **Chrome Extension**
   - Extension ID: your ID from `chrome://extensions` (for this unpacked extension).
5. Put that client ID in `.env.local` as `GOOGLE_OAUTH_CLIENT_ID`.
6. Rebuild and reload extension:
   - `bun run build`
   - In `chrome://extensions`, click **Reload**.

## Stable extension ID via manifest key

- This project now includes a fixed manifest key in [`wxt.config.ts`](./wxt.config.ts), so the extension ID is stable across rebuilds.
- Expected extension ID from this key: `hbgcpbinncbmbbefhjgfkhlngfjcooei`
- Local private key material is stored in `plugin/.keys/` and ignored by git.

## Notes

- Host access is configured as `<all_urls>` per product requirement.
- CSP allows only required API/media origins.
