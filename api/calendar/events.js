// R8 — the one endpoint src/data/google.js talks to. A thin, generic proxy
// over Google Calendar v3's events resource, scoped to a single calendarId
// per call: list (with incremental sync tokens, paginated to completion
// server-side), create, patch and delete.
//
// This route deliberately knows nothing about people, modes or colours — the
// calendar-to-member mapping lives in Settings.calendars (../../src/data/
// google.js reads it) so that a shared family calendar can be repointed at a
// different set of people without a deploy. The route only ever forwards
// what it is given, scoped to whichever single calendar the caller named.
//
// The refresh token this all rides on never leaves ../_lib/tokens.js — every
// call here mints a short-lived access token and the browser never sees it.

import { applyCors, hasValidDeviceSecret, checkRateLimit, sendError } from "../_lib/security.js";
import { mintAccessToken } from "../_lib/tokens.js";
import { readJsonBody, googleFetch, GoogleApiError } from "./_util.js";

/* A wall board's calendars are personal-scale — a handful of calendars, each
   with at most a few hundred events in the sync window. This is a runaway
   guard against an unbounded loop if Google ever returned a page token that
   never terminates, not a ceiling anyone should expect to hit. */
const MAX_PAGES = 10;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method)) {
    return sendError(res, 405, "Method not allowed");
  }
  if (!checkRateLimit(req, "calendar/events", { limit: 60, windowMs: 60_000 })) {
    return sendError(res, 429, "Too many requests");
  }
  if (!hasValidDeviceSecret(req)) {
    return sendError(res, 401, "Missing or invalid device secret");
  }

  try {
    const { accessToken } = await mintAccessToken();

    if (req.method === "GET") return await list(req, res, accessToken);
    if (req.method === "POST") return await create(req, res, accessToken);
    if (req.method === "PATCH") return await update(req, res, accessToken);
    return await remove(req, res, accessToken);
  } catch (err) {
    if (err instanceof GoogleApiError) {
      /* Both of these are ordinary, expected outcomes from the client's point
         of view — a stale sync token and a lost optimistic-concurrency race —
         so they get their own `code` rather than an opaque 5xx the client
         would otherwise have to string-match. */
      if (err.status === 410) {
        return sendJson(res, 410, { ok: false, error: err.message, code: "SYNC_TOKEN_INVALID" });
      }
      if (err.status === 412) {
        return sendJson(res, 409, { ok: false, error: err.message, code: "CONFLICT" });
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

/*
  GET ?calendarId=&timeMin=&timeMax=&syncToken=
  -> { ok: true, items, nextSyncToken }

  timeMin/timeMax and syncToken are mutually exclusive per Google's own rule
  (sending both is a 400) — the caller picks one mode, this just forwards it.
  Pagination is resolved to completion here so the client never has to know
  Google paginates at all; nextSyncToken is whatever the last page carried.
*/
async function list(req, res, accessToken) {
  const { calendarId, timeMin, timeMax, syncToken } = req.query;
  if (!calendarId) return sendError(res, 400, "calendarId is required");

  const items = [];
  let pageToken;
  let nextSyncToken;

  for (let page = 0; page < MAX_PAGES; page++) {
    const query = syncToken
      ? { syncToken: String(syncToken), pageToken }
      : {
          timeMin: timeMin ? String(timeMin) : undefined,
          timeMax: timeMax ? String(timeMax) : undefined,
          singleEvents: "true",
          orderBy: "startTime",
          pageToken,
        };

    const data = await googleFetch(
      accessToken,
      `/calendars/${encodeURIComponent(String(calendarId))}/events`,
      { query },
    );

    items.push(...(data?.items || []));
    nextSyncToken = data?.nextSyncToken || nextSyncToken;
    pageToken = data?.nextPageToken;
    if (!pageToken) break;
  }

  return sendJson(res, 200, { ok: true, items, nextSyncToken });
}

/* POST { calendarId, event } -> { ok: true, item } */
async function create(req, res, accessToken) {
  const { calendarId, event } = await readJsonBody(req);
  if (!calendarId || !event) return sendError(res, 400, "calendarId and event are required");

  const item = await googleFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: event,
    },
  );
  return sendJson(res, 200, { ok: true, item });
}

/* PATCH { calendarId, eventId, patch, etag? } -> { ok: true, item }
   `etag`, when given, rides as If-Match so a write cannot silently clobber a
   change made from Google's own UI between this board's reads. */
async function update(req, res, accessToken) {
  const { calendarId, eventId, patch, etag } = await readJsonBody(req);
  if (!calendarId || !eventId || !patch) {
    return sendError(res, 400, "calendarId, eventId and patch are required");
  }

  const item = await googleFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: patch, headers: etag ? { "If-Match": etag } : {} },
  );
  return sendJson(res, 200, { ok: true, item });
}

/* DELETE ?calendarId=&eventId= -> { ok: true }
   Idempotent: an event already gone (404/410) is success, not an error — a
   wall board can double-fire a delete and the source contract requires the
   second call to resolve cleanly. */
async function remove(req, res, accessToken) {
  const { calendarId, eventId } = req.query;
  if (!calendarId || !eventId) return sendError(res, 400, "calendarId and eventId are required");

  try {
    await googleFetch(
      accessToken,
      `/calendars/${encodeURIComponent(String(calendarId))}/events/${encodeURIComponent(String(eventId))}`,
      { method: "DELETE" },
    );
  } catch (err) {
    if (!(err instanceof GoogleApiError) || (err.status !== 404 && err.status !== 410)) throw err;
  }
  return sendJson(res, 200, { ok: true });
}
