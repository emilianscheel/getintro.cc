import { defineConfig } from "wxt";
import tsconfigPaths from "vite-tsconfig-paths";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const GOOGLE_OAUTH_CLIENT_ID =
    process.env.GOOGLE_OAUTH_CLIENT_ID ??
    "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com";
const EMAIL_LOOKUP_PROVIDER_CHAIN =
    process.env.EMAIL_LOOKUP_PROVIDER_CHAIN ?? "mock,rocketreach";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY?.trim() ?? "";
const DISABLE_GMAIL_SEND_FOR_TESTING = (() => {
    const rawValue = process.env.DISABLE_GMAIL_SEND_FOR_TESTING?.trim().toLowerCase();

    if (!rawValue) {
        return true;
    }

    return ["1", "true", "yes", "on"].includes(rawValue);
})();

export default defineConfig({
    modules: ["@wxt-dev/module-react"],
    vite: () => ({
        plugins: [tsconfigPaths()],
        define: {
            __EMAIL_LOOKUP_PROVIDER_CHAIN__: JSON.stringify(EMAIL_LOOKUP_PROVIDER_CHAIN),
            __MISTRAL_API_KEY__: JSON.stringify(MISTRAL_API_KEY),
            __DISABLE_GMAIL_SEND_FOR_TESTING__: JSON.stringify(DISABLE_GMAIL_SEND_FOR_TESTING),
        },
    }),
    manifest: {
        name: "getintro.cc",
        short_name: "getintro.cc",
        key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA60q/QxWytAxg2Sb7rzBaXxodBpGYD8NY1trdLRM6jlN/6TISSRs1ahnPJjAzA6mSrvJEgxjFMCWRjKGJk4CogVESImB5S7ROvcF7lFzm1hiJIyFMkl6x6A42+DMP2tNNwBJmU1UZxcPa9v7hE4YyAZIpz7tGGP2uGRBue9BcokijxngT90/IDx5EIzlRdGWXRHTIOCGRUqYtML8Pq0fMooltGRkoIm0dV9MuOlL9Qwyvh9/lTZLozWpTfP31qpYoITkPpm9Ds4xVFQ2LGPSgLCC5jKpo4UPDySoSaun2Gxofk/zq0jQf3lLO6Jv89gDmRGHRjsGzInuuoeJW0/1/xwIDAQAB",
        description: "Find co-founder information, draft outreach, and send through Gmail.",
        permissions: ["storage", "identity", "scripting", "tabs"],
        host_permissions: [
            "<all_urls>",
            "https://gmail.googleapis.com/*",
            "https://www.googleapis.com/*",
            "https://api.mistral.ai/*",
            "https://api.rocketreach.co/*",
        ],
        oauth2: {
            client_id: GOOGLE_OAUTH_CLIENT_ID,
            scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.compose"],
        },
        content_security_policy: {
            extension_pages:
                "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self' https://cdn.jsdelivr.net data:; connect-src 'self' http://* https://*;",
        },
        icons: {
            "16": "icons/icon-16.png",
            "32": "icons/icon-32.png",
            "48": "icons/icon-48.png",
            "128": "icons/icon-128.png",
        },
        action: {
            default_title: "getintro.cc",
            default_icon: {
                "16": "icons/icon-16.png",
                "32": "icons/icon-32.png",
            },
        },
    },
});
