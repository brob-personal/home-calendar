// R4 — liveness probe for the runbook (R14). Public: reports booleans about
// config presence only, never a secret value, so it's safe to hit from
// anywhere while still being useful for "why is the board blank" triage.

import { applyCors, checkRateLimit, sendError } from "./_lib/security.js";

export default function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET") {
    return sendError(res, 405, "Method not allowed");
  }

  if (!checkRateLimit(req, "health", { limit: 60, windowMs: 60_000 })) {
    return sendError(res, 429, "Too many requests");
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      ok: true,
      time: new Date().toISOString(),
      config: {
        googleClientConfigured: Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        ),
        refreshTokenConfigured: Boolean(process.env.GOOGLE_REFRESH_TOKEN),
        deviceSecretConfigured: Boolean(process.env.BOARD_DEVICE_SECRET),
        allowedOriginConfigured: Boolean(process.env.ALLOWED_ORIGIN),
      },
    }),
  );
}
