# R1 — Build & Tooling: handoff notes

Wave 0, role R1. Scope was the scaffold only: `family-board.jsx` is **byte-identical**
to the commit R1 received. Verify with `git diff 805e55f -- family-board.jsx` (empty).

## What `npm run <script>` does

| Script       | Purpose                                                                             |
| ------------ | ----------------------------------------------------------------------------------- |
| `dev`        | Vite dev server on `:5173`, bound to `0.0.0.0` so the iPad can load it over the LAN |
| `build`      | Production bundle to `dist/`, sourcemaps on, `es2020` + `safari14` target           |
| `preview`    | Serves the built bundle on `:4173` — use this to sanity-check the real board        |
| `test`       | `vitest run`, jsdom, single pass, exits non-zero on failure                         |
| `test:watch` | Vitest in watch mode                                                                |
| `lint`       | ESLint 9 flat config, `react-hooks` rules on                                        |
| `format`     | Prettier write. **Skips `family-board.jsx`** — see below                            |

## Decisions and deviations R0 should know about

1. **Hosting target: Vercel.** PLAN.md §1 says "cloud (Vercel / Fly / Render)" without
   choosing. §2's `api/` tree — `api/auth/google.js`, `api/calendar/events.js` — is
   Vercel's file-based serverless convention exactly, so `vercel.json` is written for
   Vercel. If R0/R4 want Fly or Render instead, `vercel.json` is the only file to
   replace; nothing in `src/` depends on the provider.

2. **`eslint.config.js`, not `.eslintrc`.** The plan names `.eslintrc`. ESLint 9 reads
   flat config and will not load `.eslintrc` without a deprecation shim. Same
   deliverable, current format.

3. **StrictMode is on.** Dev-only, ships in no production build, changes nothing
   visually. It does actively trigger **Deferred Defect #1** (`onSave` inside a
   `setStrokes` updater, `family-board.jsx:1191`) — note strokes will save twice in
   dev until R12 fixes it. That is deliberate: the plan describes that defect in terms
   of StrictMode, and turning StrictMode off would hide it until the board was on the
   wall. Toggle is one line in `src/main.jsx`.

4. **`family-board.jsx` is in `.prettierignore`.** `npm run format` would otherwise
   reflow all 2,106 lines and destroy R2's ability to review its own refactor line by
   line ("a reviewer should be able to confirm every moved line is the same line").
   Keep it ignored until R2 deletes the file.

5. **`build.target` includes `safari14`.** iPad 7th gen reaches iPadOS 17, but nothing
   guarantees the wall device is current, and a white screen on an appliance is
   expensive. R14 can drop this once the device OS is pinned in the runbook.

6. **`window.storage` still fails at runtime.** The prototype's storage seam
   (`family-board.jsx:25-41`) calls an artifact host API that exists in no browser.
   Both bodies already swallow the error, so the board runs — it just forgets
   everything on reload. That is R3's backlog item 3, not a scaffold bug. The test
   setup stubs an in-memory equivalent to keep the console clean.

## For R2

- `src/main.jsx` is the only file that knows where the board lives. Point its import
  at `./App.jsx` when the decomposition lands.
- `src/board.smoke.test.jsx` must keep passing through the refactor. If it breaks,
  behaviour changed — which R2's mandate forbids.
- Vitest picks up `src/**/*.{test,spec}.{js,jsx}`.

## For R3

- `.env.example` declares every name R4 needs. Nothing without a `VITE_` prefix ever
  reaches the client; anything with one is inlined into the bundle as plain text.

## For R13

- You inherit `src/test/setup.js` and `src/board.smoke.test.jsx`. The setup stubs
  `ResizeObserver` (jsdom has none, and `Fit` constructs one on mount) with a stub that
  never fires — jsdom reports 0x0, so a real measurement would compute `scale: 0`. The
  fixed-viewport 1080x810 pass in your backlog needs a real browser, not jsdom.
- Coverage is wired (`npm run test:coverage`, v8 provider) with no thresholds set.
  Thresholds are yours.
