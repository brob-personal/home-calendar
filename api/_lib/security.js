// R4 — cross-cutting request guards for every serverless endpoint: CORS
// locked to one origin, a device secret so the API is not open to the whole
// internet, and best-effort rate limiting.
//
// Rate limiting is in-memory and per-instance. Vercel serverless functions
// are ephemeral — a cold start resets the counters — so this stops casual
// abuse and runaway retry loops, not a determined attacker. That is a known
// limitation, not an oversight; a real limiter needs a shared store (KV/Redis)
// which is out of scope until the board actually needs it.

import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { optionalEnv } from "./env.js";

/**
 * Constant-time string compare so a secret check can't be timed byte-by-byte.
 * @param {string} a
 * @param {string} b
 */
export function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return nodeTimingSafeEqual(bufA, bufB);
}

/**
 * Sets CORS headers restricted to ALLOWED_ORIGIN. Handles the OPTIONS
 * preflight itself.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true if the caller should stop (preflight handled)
 */
export function applyCors(req, res) {
  const allowedOrigin = optionalEnv("ALLOWED_ORIGIN");
  const origin = req.headers.origin;

  if (allowedOrigin && origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Board-Secret");
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

/**
 * Checks the shared-secret device header/query against BOARD_DEVICE_SECRET.
 * @param {import('http').IncomingMessage & { query?: Record<string, unknown> }} req
 */
export function hasValidDeviceSecret(req) {
  const expected = optionalEnv("BOARD_DEVICE_SECRET");
  if (!expected) return false;

  const header = req.headers["x-board-secret"];
  const fromQuery = req.query?.secret;
  const provided = Array.isArray(header) ? header[0] : header || fromQuery;
  if (!provided) return false;

  return timingSafeEqual(String(provided), expected);
}

const buckets = new Map();

/**
 * Fixed-window limiter keyed by route + client IP.
 * @param {import('http').IncomingMessage} req
 * @param {string} routeKey
 * @param {{ limit?: number, windowMs?: number }} [opts]
 * @returns {boolean} true if the request is allowed
 */
export function checkRateLimit(req, routeKey, opts = {}) {
  const limit = opts.limit ?? 30;
  const windowMs = opts.windowMs ?? 60_000;

  const forwardedFor = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0].trim() ||
    "unknown";
  const key = `${routeKey}:${ip}`;
  const now = Date.now();

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= limit;
}

/** Sends a uniform JSON error body. */
export function sendError(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: false, error: message }));
}
