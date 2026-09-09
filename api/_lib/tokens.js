// R4 — the single seam that turns a server-side refresh token into a
// short-lived Google access token. R8 (calendar) and R9 (drive) import
// `mintAccessToken` directly — a function call inside the same serverless
// runtime, never an HTTP hop — so the refresh token itself never leaves this
// module and the access token never reaches the browser.

import { requireEnv } from "./env.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Module-scope cache. Survives across invocations on a warm Vercel instance,
// worthless on a cold start — that's fine, a mint is one cheap round trip.
let cached = null; // { accessToken, expiresAt }

const EXPIRY_SKEW_MS = 60_000;

/**
 * Returns a live Google access token, minting or refreshing as needed.
 * @param {{ forceRefresh?: boolean }} [opts]
 * @returns {Promise<{ accessToken: string, expiresAt: number }>}
 */
export async function mintAccessToken(opts = {}) {
  const { forceRefresh = false } = opts;

  if (!forceRefresh && cached && cached.expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return cached;
  }

  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const refreshToken = requireEnv("GOOGLE_REFRESH_TOKEN");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Google token refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  cached = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cached;
}

/** Test/ops hook — drops the in-memory cache. */
export function clearTokenCache() {
  cached = null;
}
