// R9 — streams one image's bytes from Drive. This is the URL that actually
// ends up in Screensaver's `background-image`, which is why the device
// secret is accepted from the query string: a CSS background-image (or an
// <img src>) load cannot attach a custom header, and
// api/_lib/security.js's hasValidDeviceSecret already falls back to
// `req.query.secret` for exactly this shape of request.
//
// Proxying bytes rather than handing back a Drive URL is the point — Drive
// has no equivalent of a short-lived signed S3 URL, and the board's Google
// access token must never reach the iPad. This route holds the token
// server-side (api/_lib/tokens.js) and the client only ever sees its own
// output.

import { mintAccessToken } from "../_lib/tokens.js";
import { applyCors, hasValidDeviceSecret, checkRateLimit, sendError } from "../_lib/security.js";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET") {
    return sendError(res, 405, "Method not allowed");
  }

  // Higher limit than photos.js — one screensaver rotation can touch several
  // of these in the same minute, on top of the preloader in src/data/drive.js
  // warming every image in the list up front.
  if (!checkRateLimit(req, "drive/photo", { limit: 120, windowMs: 60_000 })) {
    return sendError(res, 429, "Too many requests");
  }

  if (!hasValidDeviceSecret(req)) {
    return sendError(res, 401, "Missing or invalid device secret");
  }

  const id = String(req.query.id || "");
  if (!id) {
    return sendError(res, 400, "Missing id");
  }

  try {
    const { accessToken } = await mintAccessToken();
    const driveRes = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!driveRes.ok) {
      return sendError(
        res,
        driveRes.status === 404 ? 404 : 502,
        `Drive fetch failed: ${driveRes.status}`,
      );
    }

    const buffer = Buffer.from(await driveRes.arrayBuffer());
    res.statusCode = 200;
    res.setHeader(
      "Content-Type",
      driveRes.headers.get("content-type") || "application/octet-stream",
    );
    // An hour: long enough that a 30s-rotation screensaver isn't re-fetching
    // the same frame every lap, short enough that a photo removed from the
    // Drive folder ages out of any intermediate cache same-day.
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.end(buffer);
  } catch (err) {
    sendError(res, 502, err.message);
  }
}
