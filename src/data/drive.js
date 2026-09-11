/*
  ============================================================================
  DRIVE PHOTO SCREENSAVER — R9, backlog items 2, 3 and 4
  ----------------------------------------------------------------------------
  "List image files in the folder via the Drive API; proxy or sign URLs
  server-side." / "Prefetch and cache the next few images so rotation never
  shows a blank frame." / "Wire into Screensaver, preserving its 30s rotation,
  scrim, clock and next-event line."

  Same shape as ../components/weather/useWeather.js and ./weather.js: a pure
  network function a test can call directly (`listDrivePhotos`), a cached
  degrading wrapper (`getDrivePhotos`), and a hook that polls it. The board's
  Google credential never reaches this file — `api/drive/**` mints its own
  access token server-side (../../api/_lib/tokens.js) and this module only
  ever talks to that proxy, never to Google directly.

  Two Drive endpoints, both under api/drive/**:
    - GET /api/drive/photos?folderId=
          -> { ok, files: [{id, name, mimeType, thumbnailLink}] }
        A metadata list. No image bytes, so no auth headers needed on the
        <img>/background-image consumer.
    - GET /api/drive/photo?id=&secret= -> the image bytes, proxied
        This is what a CSS `background-image: url(...)` or an <img src> tag
        actually loads, and neither can attach a custom header — so the device
        secret has to travel as a query parameter here. That is exactly the
        `req.query.secret` fallback api/_lib/security.js's hasValidDeviceSecret
        already supports, and exactly why VITE_BOARD_DEVICE_SECRET is
        documented in .env.example as "unavoidably visible to anyone with the
        device or the bundle" — it identifies the board, not a Google account.

  HEIC is why the list carries `thumbnailLink` and why the byte proxy is now
  the fallback rather than the default. The proxy streams a file's original
  bytes with its original Content-Type, and a Chromium kiosk cannot decode
  `image/heic` — every photo the iPad itself shot was a blank frame, and only
  jpg/png ever painted. Drive will hand back a server-generated JPEG preview
  for anything it can preview, HEIC and HEIF included, and that preview URL is
  pre-signed: no Authorization header, so nothing about using it from the
  board weakens the "the Google token never reaches the iPad" property above.

  The cost is that those URLs expire. That makes them safe to hold in memory
  and for one poll cycle on disk, and unsafe to treat as durable — hence
  CACHE_TTL_MS below, and hence nothing here writes them anywhere but the one
  cache key it already owned.

  Photos are not persisted here as bytes — only the resolved proxy URL list is
  cached (localStorage, via ../lib/store.js), the same "aggressive cache,
  quiet degrade" shape as weather. Emptying the Drive folder is a *successful*
  list call that returns zero files, which is indistinguishable at the
  Screensaver from "never configured" — both leave `photos` empty, and
  Screensaver's own `hasPhoto` branch (src/components/idle/Screensaver.jsx)
  already falls back to month art for that case. An *unreachable* folder (dead
  network, expired auth) instead serves the last cached list, so a network
  blip does not blank the screensaver mid-rotation.
  ============================================================================
*/
import { useEffect } from "react";

import { store } from "../lib/store.js";

const CACHE_KEY = "drivePhotoCache";
const POLL_MS = 30 * 60 * 1000;

/*
  How long a cached list may still be served on the degrade path.

  The cache exists so a network blip does not blank a rotating screensaver,
  and before thumbnailLink it could be served forever — proxy URLs are ours
  and never expire. A signed Drive preview URL does, on a window Google does
  not document, so "forever" would trade a blank frame for a broken one.

  45 minutes is one full POLL_MS cycle plus headroom: a single failed poll
  still rotates photos, two in a row falls back to month art via Screensaver's
  own `hasPhoto` branch. An entry written before this field existed has no
  `at`, so the comparison is NaN and it reads as stale — which is what we
  want, since those hold proxy URLs from the previous shape.
*/
const CACHE_TTL_MS = 45 * 60 * 1000;

/*
  The canvas is 1080x810 CSS px, 2160x1620 at the iPad's 2x scale (see
  ../lib/canvas.js), and Screensaver paints photos with `background-size:
  cover` — so the image is upscaled to fill whichever axis is short. Drive's
  default 220px thumbnail is visibly mushy at that size.

  1920 is the ceiling worth asking for: it covers the canvas on a 2x panel
  with almost nothing left over, while asking for the full 2160 buys pixels
  the JPEG re-encode has already thrown away and costs a slower first paint
  on every rotation.
*/
const THUMB_SIZE = 1920;

/*
  Avatars are the other consumer of this file and have the opposite problem:
  ../components/shell/Avatar.jsx renders at most 44 CSS px (88 at 2x), so
  asking for a screensaver-sized rendition would pull ~1MB to paint a thumb
  the size of a fingernail. 128 covers the largest avatar on a 2x panel.
*/
const AVATAR_THUMB_SIZE = 128;

/*
  Drive returns the size two different ways depending on which thumbnail host
  the file lands on, so sizedThumbnail both replaces and appends rather than
  assuming one shape:

    lh3.googleusercontent.com/<opaque>=s220   an `=`-delimited option suffix
    docs.google.com/feeds/vt?gd=true&sz=s220  a query parameter

  and a link carrying no size marker at all gets one appended.
*/
const SIZE_SUFFIX = /=[a-z]\d+(?:-[a-z0-9]+)*$/i;

/*
  Per-member avatars have no poll cycle — Family section notes there is no
  5-minute refresh for this, unlike settings.photos above. A folder id is
  resolved once and kept for the life of the page; a failure is evicted so a
  later call (e.g. Settings reopened) can retry instead of being stuck null
  forever from one transient network blip.
*/
const firstPhotoCache = new Map(); // folderId -> Promise<string|null>

function apiBase() {
  return import.meta.env.VITE_API_BASE_URL || "/api";
}

function deviceSecret() {
  return import.meta.env.VITE_BOARD_DEVICE_SECRET || "";
}

function authHeaders() {
  const secret = deviceSecret();
  return secret ? { "X-Board-Secret": secret } : {};
}

/*
  The URL Screensaver actually paints. It carries the device secret as a
  query param for the reason above, and nothing else identifying — no folder
  id, no file name.
*/
function photoUrl(id) {
  const params = new URLSearchParams({ id });
  const secret = deviceSecret();
  if (secret) params.set("secret", secret);
  return `${apiBase()}/drive/photo?${params.toString()}`;
}

/**
 * Rewrites a Drive thumbnailLink to ask for `size` px on its longest edge
 * instead of the ~220 Drive hands back by default.
 *
 * @param {string} link
 * @param {number} [size]
 * @returns {string}
 */
export function sizedThumbnail(link, size = THUMB_SIZE) {
  if (!link) return "";

  try {
    const url = new URL(link);
    if (url.searchParams.has("sz")) {
      url.searchParams.set("sz", `s${size}`);
      return url.toString();
    }
  } catch {
    /* Not an absolute URL — fall through to the suffix forms. */
  }

  if (SIZE_SUFFIX.test(link)) return link.replace(SIZE_SUFFIX, `=s${size}`);
  return `${link}=s${size}`;
}

/*
  Warms the browser's own HTTP cache so the 30s rotation in Screensaver never
  lands on a URL it has to wait on. A personal photo folder is tens of images,
  not thousands, so prefetching the whole list at once — rather than tracking
  "the next few" relative to the current rotation index, which Screensaver's
  own state owns, not this module's — is the simple version of item 3 that
  still meets it: by the time rotation reaches image N, image N has been an
  <Image> load away from the moment the list resolved.
*/
function preload(urls) {
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
}

/**
 * One live list call to the Drive proxy. Throws on any network, HTTP or
 * malformed-response failure — getDrivePhotos is what degrades, this stays a
 * straight mapping, same split as fetchWeatherSnapshot/getWeather in
 * ./weather.js.
 *
 * Prefers Drive's own thumbnailLink — a JPEG rendition of any previewable
 * file, which is the whole reason HEIC paints — and falls back to the byte
 * proxy for a file Drive has not generated a preview for yet. That fallback
 * is not dead code: a photo uploaded seconds ago can list before its
 * thumbnail exists, and for a jpg the proxy renders it perfectly well.
 *
 * @param {string} folderId
 * @returns {Promise<string[]>} image URLs, newest first
 */
export async function listDrivePhotos(folderId) {
  const params = new URLSearchParams({ folderId });
  const res = await fetch(`${apiBase()}/drive/photos?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const json = await res.json();
  const files = Array.isArray(json.files) ? json.files : [];
  return files.map((f) => (f.thumbnailLink ? sizedThumbnail(f.thumbnailLink) : photoUrl(f.id)));
}

/**
 * The cached, degrading read Screensaver's data actually flows through.
 *
 * No folder configured resolves `[]` immediately, same as weather's null
 * island for "not configured yet" — Screensaver already reads an empty array
 * as "show month art". A successful call (including an empty folder) is
 * cached and returned. A failed one falls back to whatever was last cached
 * *for this folder id* — switching folders during an outage must not show
 * stale photos from the previous folder — and only while that entry is still
 * inside CACHE_TTL_MS, because the URLs in it are signed and do expire.
 * Anything else resolves `[]`.
 *
 * @param {string} folderId
 * @returns {Promise<string[]>}
 */
export async function getDrivePhotos(folderId) {
  if (!folderId) return [];
  try {
    const photos = await listDrivePhotos(folderId);
    preload(photos);
    try {
      await store.set(CACHE_KEY, { folderId, photos, at: Date.now() });
    } catch {
      /* Swallowed deliberately — see the doc comment above. */
    }
    return photos;
  } catch {
    try {
      const cached = await store.get(CACHE_KEY);
      if (cached?.folderId !== folderId) return [];
      return Date.now() - cached.at < CACHE_TTL_MS ? cached.photos : [];
    } catch {
      return [];
    }
  }
}

async function fetchFirstDrivePhotoUrl(folderId) {
  const params = new URLSearchParams({ folderId });
  const res = await fetch(`${apiBase()}/drive/photos?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const json = await res.json();
  const files = Array.isArray(json.files) ? json.files : [];
  if (!files.length) return null;
  const first = [...files].sort((a, b) => a.name.localeCompare(b.name))[0];
  // Same HEIC reasoning as listDrivePhotos — an avatar folder holding a photo
  // straight off an iPhone is exactly the case that used to render blank —
  // but at avatar scale rather than screensaver scale.
  return first.thumbnailLink
    ? sizedThumbnail(first.thumbnailLink, AVATAR_THUMB_SIZE)
    : photoUrl(first.id);
}

/**
 * The proxied URL of a Drive folder's first image file, sorted alphabetically
 * by filename — Avatar.jsx's photo source when a member has a
 * `photoDriveFolderId`. `null` covers every case Avatar.jsx should fall back
 * from: no folder configured, an empty/inaccessible folder, or a failed list
 * call.
 *
 * Unlike `listDrivePhotos`, this never throws — there is no `getDrivePhotos`
 * equivalent wrapping it, so it degrades internally instead.
 *
 * @param {string} folderId
 * @returns {Promise<string|null>}
 */
export function getFirstDrivePhotoUrl(folderId) {
  if (!folderId) return Promise.resolve(null);
  if (firstPhotoCache.has(folderId)) return firstPhotoCache.get(folderId);

  const promise = fetchFirstDrivePhotoUrl(folderId).catch(() => null);
  firstPhotoCache.set(folderId, promise);
  promise.then((url) => {
    if (url === null) firstPhotoCache.delete(folderId);
  });
  return promise;
}

function sameList(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Keeps `settings.photos` fed from the configured Drive folder. Side-effect
 * only — CONTRACTS.md §6 says it plainly: "settings.photos still feeds
 * Screensaver unchanged", so this writes into that same field rather than
 * threading a parallel prop past App.jsx. `setSettings` only fires when the
 * resolved list actually differs from what is already there, so a folder that
 * never changes does not re-persist the whole settings blob every poll.
 *
 * Takes `settings`/`setSettings` as explicit arguments rather than reading
 * BoardContext — same convention as useSleep/useMemberFilter, and the only
 * option here besides: App.jsx is the component that renders
 * `<BoardContext.Provider>`, so a hook reading that context could not resolve
 * it from inside App's own body, only from a descendant.
 *
 * Call once from a component that is always mounted — see the disclosed
 * addition to src/App.jsx (PLAN.md's R9 note), the same pattern R6 used to
 * wire WeatherWidget into Header.jsx.
 *
 * @param {import("../contracts/schema.js").Settings} settings
 * @param {(updater: (s: import("../contracts/schema.js").Settings) => import("../contracts/schema.js").Settings) => void} setSettings
 */
export function useDrivePhotos(settings, setSettings) {
  const folderId = settings.drive.folderId;

  useEffect(() => {
    let cancelled = false;

    const apply = (next) => {
      if (cancelled) return;
      setSettings((s) => (sameList(s.photos, next) ? s : { ...s, photos: next }));
    };

    if (!folderId) {
      apply([]);
      return () => {
        cancelled = true;
      };
    }

    const load = () => {
      getDrivePhotos(folderId).then(apply);
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [folderId, setSettings]);
}
