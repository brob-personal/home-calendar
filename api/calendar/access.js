// R8 — a thin companion to events.js, scoped to one question: what access
// does the authenticated board account have on a given calendar? Google
// answers that on the calendarList resource, not the calendar or events one,
// so this is its own route rather than a query param bolted onto events.js.
//
// src/data/google.js calls this when a calendar id is entered in Settings and
// again on every 5-minute poll, since access can be revoked by the calendar's
// owner at any time — the result is not a one-time setup fact.

import { applyCors, hasValidDeviceSecret, checkRateLimit, sendError } from "../_lib/security.js";
import { mintAccessToken } from "../_lib/tokens.js";
import { googleFetch, GoogleApiError } from "./_util.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET") {
    return sendError(res, 405, "Method not allowed");
  }
  if (!checkRateLimit(req, "calendar/access", { limit: 60, windowMs: 60_000 })) {
    return sendError(res, 429, "Too many requests");
  }
  if (!hasValidDeviceSecret(req)) {
    return sendError(res, 401, "Missing or invalid device secret");
  }

  const { calendarId } = req.query;
  if (!calendarId) return sendError(res, 400, "calendarId is required");

  try {
    const { accessToken } = await mintAccessToken();
    const data = await googleFetch(
      accessToken,
      `/users/me/calendarList/${encodeURIComponent(String(calendarId))}`,
    );
    return sendJson(res, 200, { ok: true, accessRole: data?.accessRole || null });
  } catch (err) {
    if (err instanceof GoogleApiError) {
      /* A calendar id the board account cannot see at all (never shared,
         unshared since, or simply mistyped) is not an unlike-us server
         error — the client already treats "no known access" the same as
         "read-only" (neither is writable), so this is reported the same way
         as a real accessRole rather than surfaced as a 5xx. */
      if (err.status === 404) {
        return sendJson(res, 200, { ok: true, accessRole: null });
      }
      return sendError(res, err.status, err.message);
    }
    return sendError(res, 502, err.message);
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
