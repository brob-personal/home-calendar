// R4 — forces a token mint/refresh and reports whether it worked, without
// ever putting the token itself in the response. Used by the runbook (R14)
// and by R13's tests to prove auth is wired end-to-end, and by ops to confirm
// a mint still works after rotating a secret.

import { mintAccessToken } from "../_lib/tokens.js";
import { applyCors, hasValidDeviceSecret, checkRateLimit, sendError } from "../_lib/security.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET" && req.method !== "POST") {
    return sendError(res, 405, "Method not allowed");
  }

  if (!checkRateLimit(req, "auth/refresh", { limit: 20, windowMs: 60_000 })) {
    return sendError(res, 429, "Too many requests");
  }

  if (!hasValidDeviceSecret(req)) {
    return sendError(res, 401, "Missing or invalid device secret");
  }

  try {
    const { expiresAt } = await mintAccessToken({ forceRefresh: true });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, expiresAt }));
  } catch (err) {
    sendError(res, 502, err.message);
  }
}
