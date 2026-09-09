// R8 — shared helpers for the calendar proxy. Everything in api/calendar/**
// goes through here so the two routes stay thin translations of the client
// contract onto Google's, rather than each reimplementing fetch plumbing.

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Vercel's Node runtime parses `req.query` for us but leaves the body a
 * stream unless a framework sits in front of it — nothing here does, so every
 * route that accepts a body reads it the same way. `req.body` is checked
 * first so this stays correct if that ever changes.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<object>}
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Thrown for any non-2xx response from Google. Carries the upstream status so
 * the route can tell apart the shapes the client actually needs to react to
 * — 410 (a sync token has gone stale) and 412 (an etag lost a race) — from
 * everything else, which is just an error.
 */
export class GoogleApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
  }
}

/**
 * One authenticated call to the Calendar v3 API.
 * @param {string} accessToken
 * @param {string} path Appended to https://www.googleapis.com/calendar/v3, e.g. "/calendars/x/events".
 * @param {{method?: string, query?: Record<string, string|undefined>, body?: unknown, headers?: Record<string,string>}} [opts]
 */
export async function googleFetch(accessToken, path, opts = {}) {
  const url = new URL(`${CALENDAR_API}${path}`);
  for (const [key, value] of Object.entries(opts.query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  /* Google's delete returns 204 with no body — nothing downstream should try
     to JSON.parse that. */
  if (res.status === 204) return null;

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new GoogleApiError(
      res.status,
      json?.error?.message || `Google Calendar API error ${res.status}`,
    );
  }
  return json;
}
