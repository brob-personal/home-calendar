/*
  Which build is running, as the running build sees it.

  vite.config.js's `define` substitutes these two identifiers for string
  literals at build time — the short commit SHA and an ISO timestamp. This file
  is the only place that touches the raw globals, for two reasons: esbuild's
  substitution is textual, so a bundler or test runner that does not apply the
  same `define` leaves them undeclared and a bare reference throws at module
  scope; and a `typeof` guard written once is easier to trust than the same
  guard written at four call sites.

  Why this exists at all is in vite.config.js: the board cannot be reloaded
  without a four-step Guided Access dance, six fixes for the same artefact
  shipped inside 84 minutes, and there is no way to tell from a photograph of
  the wall which of them the device was actually running. A reading that does
  not carry a SHA is not evidence about a build.

  BUILD_STAMP is the compact form for the always-on corner badge, where the
  space is a dozen characters wide and has to stay legible in a photograph
  taken across a room: the SHA, then the build's month-day and UTC hour-minute.
  The overlay prints BUILD_TIME in full.
*/
export const BUILD_SHA = typeof __BUILD_SHA__ === "string" ? __BUILD_SHA__ : "nodefine";

export const BUILD_TIME = typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : "nodefine";

/*
  `2026-09-15T14:20:31.902Z` -> `0915.1420Z`. Sliced off the ISO string rather
  than reformatted through Date, so a placeholder value passes through as
  itself instead of becoming "Invalid Date".
*/
function compactTime(iso) {
  const m = /^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}${m[2]}.${m[3]}${m[4]}Z` : iso;
}

export const BUILD_STAMP = `${BUILD_SHA} ${compactTime(BUILD_TIME)}`;
