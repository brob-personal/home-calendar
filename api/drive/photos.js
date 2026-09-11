// R9 — lists the image files in the configured Drive folder. Metadata only
// (id, name, mimeType, thumbnailLink): no image bytes cross this endpoint, so
// the response needs no device-secret-in-query concession the way
// api/drive/photo.js does — a plain fetch with a header is fine here.
//
// The refresh token that backs mintAccessToken() stays server-side, minted by
// R4's api/_lib/tokens.js. This route never sees it directly.
//
// `thumbnailLink` is why HEIC photos render at all. api/drive/photo.js streams
// the original bytes, and an iPad-shot .heic streamed as `image/heic` is a
// blank frame in a Chromium kiosk — only jpg/png ever painted. Drive's
// thumbnailLink is a server-generated JPEG for anything Drive can preview,
// HEIC included, so no client- or server-side transcode is needed. It is also
// pre-signed and needs no Authorization header, so handing it to the board
// leaks nothing: the Google access token still never leaves this process.
//
// The signature is time-limited, though, which is the one string attached.
// Nothing downstream may treat these URLs as durable — see the TTL on the
// degrade cache in src/data/drive.js.

import { mintAccessToken } from "../_lib/tokens.js";
import { optionalEnv } from "../_lib/env.js";
import { applyCors, hasValidDeviceSecret, checkRateLimit, sendError } from "../_lib/security.js";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const PAGE_SIZE = 50;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET") {
    return sendError(res, 405, "Method not allowed");
  }

  if (!checkRateLimit(req, "drive/photos", { limit: 30, windowMs: 60_000 })) {
    return sendError(res, 429, "Too many requests");
  }

  if (!hasValidDeviceSecret(req)) {
    return sendError(res, 401, "Missing or invalid device secret");
  }

  // DRIVE_FOLDER_ID is the .env.example seed — "also settable in Settings at
  // runtime, which is the intended path; this is just a seed" — so a client
  // that has not configured a folder yet still gets one for free.
  const folderId = String(req.query.folderId || optionalEnv("DRIVE_FOLDER_ID") || "");
  if (!folderId) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, files: [] }));
  }

  try {
    const { accessToken } = await mintAccessToken();

    // Read-only listing: images only, not trashed, newest first. R9's item 2.
    //
    // `mimeType contains 'image/'` is a prefix match, not an allowlist, so
    // image/heic and image/heif already survive this step — there is no
    // jpeg/png filter here to lift. Narrowing this to named types would be
    // what breaks HEIC; leave it broad.
    const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
    const url = new URL(DRIVE_FILES_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("fields", "files(id,name,mimeType,thumbnailLink)");
    url.searchParams.set("orderBy", "modifiedTime desc");
    url.searchParams.set("pageSize", String(PAGE_SIZE));

    const driveRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!driveRes.ok) {
      const text = await driveRes.text().catch(() => "");
      return sendError(res, 502, `Drive list failed: ${driveRes.status} ${text}`);
    }

    const json = await driveRes.json();
    // thumbnailLink is absent for a file Drive has not generated a preview for
    // yet. Passing it through as undefined rather than inventing a value lets
    // src/data/drive.js fall back to the byte proxy for that one file.
    const files = (json.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      thumbnailLink: f.thumbnailLink,
    }));

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    // Short — a photo added to the folder should show up on the wall within
    // a poll cycle, not sit behind a stale CDN-length cache. Doubly so now
    // that the body carries signed thumbnailLinks: a minute is far inside
    // their validity window, so no client can be handed an expired one here.
    res.setHeader("Cache-Control", "private, max-age=60");
    res.end(JSON.stringify({ ok: true, files }));
  } catch (err) {
    sendError(res, 502, err.message);
  }
}
