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

  There used to be a third export, BUILD_STAMP — a compacted `SHA 0915.1420Z`
  sized for the always-on corner badge. The badge is gone (#60) and nothing
  else ever wanted the abbreviated form, so it went with it. Settings ->
  Display diagnostics prints both values below in full, which is the only
  place either is read now.
*/
export const BUILD_SHA = typeof __BUILD_SHA__ === "string" ? __BUILD_SHA__ : "nodefine";

export const BUILD_TIME = typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : "nodefine";
