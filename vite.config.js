import { execSync } from "node:child_process";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
  Build identity, baked in at build time.

  The board is a standalone home-screen PWA with no address bar, no reload
  button and no pull-to-refresh, so picking up a deploy is a four-step manual
  dance through Guided Access and the app switcher (docs/DEVICE-SETUP.md §4).
  Six fixes for the grey band along the bottom of the board shipped inside 84
  minutes. If that dance was skipped even once, one of them was judged against
  the previous build's code — which on its own reproduces the loop those six
  passes went round: a fix lands, the artefact is still on screen, the next
  pass concludes the mechanism must be something else.

  There is no way to rule that out after the fact, and no way to rule it out at
  all without the running build naming itself on screen. So the SHA and the
  build time are compile-time constants, rendered in the corner of the board by
  src/components/shell/DiagSurface.jsx and repeated in the diagnostic overlay.
  Until a reading carries a SHA, it is not evidence about a particular build.

  Read through src/lib/build.js rather than referenced directly, so a bundle
  built by something that does not apply `define` (vitest, mostly) degrades to
  a placeholder instead of throwing on an undefined global.
*/
function buildSha() {
  // Vercel builds from a tarball with no .git directory to interrogate, and
  // exposes the commit as an env var instead. Prefer it: on the deploy that
  // actually reaches the wall, it is the only one of the two that exists.
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // A source tree with no git and no CI env var still has to build.
    return "nogit";
  }
}

// Kept as a plain object (not a function) so vitest.config.js can mergeConfig
// against it and inherit the React plugin without duplicating it.
export default defineConfig({
  plugins: [react()],

  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  server: {
    // host:true binds 0.0.0.0 so the iPad can load the dev server over the LAN
    // while you are still iterating — the board is never developed on-device.
    host: true,
    port: 5173,
  },

  preview: {
    host: true,
    port: 4173,
  },

  build: {
    outDir: "dist",
    sourcemap: true,

    // iPad 7th gen (A2197) tops out at iPadOS 17, but there is no guarantee the
    // wall device is current. safari14 is cheap insurance against a board that
    // white-screens because it was never updated; drop it once the device OS is
    // pinned in R14's runbook.
    target: ["es2020", "safari14"],
  },
});
