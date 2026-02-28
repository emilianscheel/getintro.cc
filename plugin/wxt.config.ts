import { defineConfig } from "wxt";
import tsconfigPaths from "vite-tsconfig-paths";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const GOOGLE_OAUTH_CLIENT_ID =
    process.env.GOOGLE_OAUTH_CLIENT_ID ??
    "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com";

export default defineConfig({
    modules: ["@wxt-dev/module-react"],
    vite: () => ({
        plugins: [tsconfigPaths()],
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
                "script-src 'self'; object-src 'self'; img-src 'self' data: https://hebbkx1anhila5yf.public.blob.vercel-storage.com; media-src 'self' https://hebbkx1anhila5yf.public.blob.vercel-storage.com; connect-src 'self' https://gmail.googleapis.com https://www.googleapis.com https://api.mistral.ai https://api.rocketreach.co https://hebbkx1anhila5yf.public.blob.vercel-storage.com;",
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
