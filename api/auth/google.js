// R4 — Google OAuth consent + callback, combined in one route because Google
// redirects back to the same URI it was sent from.
//
// This endpoint is an operator/setup path, not something the iPad ever calls.
// Run once (and again only if the refresh token is ever revoked): visit
// /api/auth/google?secret=<BOARD_DEVICE_SECRET> in a browser signed into the
// Google account the board should read, approve consent, then copy
// the refresh token shown on the callback page into the GOOGLE_REFRESH_TOKEN
// env var and redeploy. The token is shown exactly once, to the operator's
// own browser, never to the iPad and never logged.

import { requireEnv, optionalEnv } from "../_lib/env.js";
import { hasValidDeviceSecret, checkRateLimit, sendError } from "../_lib/security.js";
import { createHmac, timingSafeEqual } from "node:crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_TTL_MS = 10 * 60_000;

function signState(secret) {
  const timestamp = Date.now().toString();
  const mac = createHmac("sha256", secret).update(timestamp).digest("hex");
  return `${timestamp}.${mac}`;
}

function verifyState(secret, state) {
  if (!state || typeof state !== "string" || !state.includes(".")) return false;
  const [timestamp, mac] = state.split(".");
  if (!timestamp || !mac) return false;
  if (Date.now() - Number(timestamp) > STATE_TTL_MS) return false;

  const expectedMac = createHmac("sha256", secret).update(timestamp).digest("hex");
  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expectedMac);
  if (macBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(macBuf, expectedBuf);
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "Method not allowed");
  }

  if (!checkRateLimit(req, "auth/google", { limit: 10, windowMs: 60_000 })) {
    return sendError(res, 429, "Too many requests");
  }

  const deviceSecret = requireEnv("BOARD_DEVICE_SECRET");
  const { code, state, error } = req.query;

  if (error) {
    return sendError(res, 400, `Google denied consent: ${error}`);
  }

  // Step 2: Google's redirect back with an authorization code.
  if (code) {
    if (!verifyState(deviceSecret, state)) {
      return sendError(res, 400, "Invalid or expired state");
    }

    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
    const redirectUri = requireEnv("GOOGLE_REDIRECT_URI");

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text().catch(() => "");
      return sendError(res, 502, `Token exchange failed: ${tokenResponse.status} ${text}`);
    }

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(
        "<p>Google returned no refresh token. This account already granted consent " +
          "without <code>prompt=consent</code> having been honored. Revoke access at " +
          '<a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> ' +
          "and try again.</p>",
      );
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html");
    return res.end(
      "<p>Consent complete. Copy this value into the <code>GOOGLE_REFRESH_TOKEN</code> " +
        "env var and redeploy. It will not be shown again.</p>" +
        `<pre>${escapeHtml(tokens.refresh_token)}</pre>`,
    );
  }

  // Step 1: kick off consent. Gated so a random visitor can't trigger a
  // Google login prompt that, if completed, would point the board at their
  // own calendar instead of the owner's.
  if (!hasValidDeviceSecret(req)) {
    return sendError(res, 403, "Missing or invalid secret");
  }

  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const redirectUri = requireEnv("GOOGLE_REDIRECT_URI");
  const scopes = optionalEnv("GOOGLE_SCOPES") || "";

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", signState(deviceSecret));

  res.statusCode = 302;
  res.setHeader("Location", authUrl.toString());
  res.end();
}
