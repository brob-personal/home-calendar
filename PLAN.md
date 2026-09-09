# Family Board — Agent Role Charter & Execution Plan

> **What this file is.** A dispatch document. It carves the project into roles that
> own disjoint sets of files, orders those roles into waves, and gives each one a
> backlog with acceptance criteria. Agents can be launched in parallel within a wave
> without stepping on each other. `SCOPING.txt` is the requirements source of truth;
> this file is the execution source of truth.

---

## 1. Where the project stands

`family-board.jsx` — 2,106 lines, one file — is a working prototype of the wall board.
It is **artifact-shaped, not app-shaped**: a single `export default function FamilyBoard()`,
a 378-line CSS template literal, `window.storage` instead of `localStorage`, an in-memory
`createMockSource()`, no `package.json`, no bundler, no mount call, no tests.

### Already built — preserve this work

| Feature | Where |
|---|---|
| 60/30/10 pastel palette, 5 light themes, CSS custom properties | `THEMES` 47–53, `cssVars` 572 |
| Per-person hue + 11 colorId sub-shades + hard diagonal split for shared events | `hexToHsl` 125, `VARIATIONS` 144, `variantColor` 159, `splitFill` 169 |
| Sticky notes: pencil FAB, draggable yellow window, pointer-event drawing, normalized 0–1 strokes, per-day history | 1086–1309 |
| Sleep mode with midnight-wrap handling and tap-to-wake | `isAsleep` 368, `SleepVeil` 1630 |
| Milestone countdown ticker, authorable from the composer | `milestones` 533, `Countdowns` 743 |
| Avatar filtering that propagates to every view + Reset chip | 476–488, `.is-off` 1931 |
| Week / Month / Agenda views | 854 / 931 / 977 |
| `list` / `create` / `remove` source seam — the clean insertion point for Google | 286–298 |
| Fixed 1080×810 canvas + `Fit` ResizeObserver scaler | 17–18, 398–420 |

### Not built, or built wrong

| Gap | Evidence |
|---|---|
| Google Calendar sync is a **block comment**, not code. No network call exists. Events reset every reload. | 301–350; the `fetch` at 325 is inside `/* */` |
| Drive photo screensaver: UI done, API absent, `photos: []` with no way to populate it | `Screensaver` 1643, settings 92 |
| **Weather: entirely absent.** Zero matches in 2,106 lines. | — |
| **To-do / chores tab: entirely absent.** | view list hardcoded at 1035 |
| **Roommate vs Personal mode: entirely absent.** | — |
| **`DayView` is rotated 90° from spec** — people are rows down the left, time runs horizontally, hour axis sits below. Spec wants time on the vertical left axis, people across the top. | 765–847, `.fb-axis` 1825 |
| Delete is `onDoubleClick` in Day view only — unreliable on iOS Safari, destructive, no confirm, unreachable elsewhere | 821 |
| Hit targets below Apple's 44pt minimum | `.fb-pen` 22px, `.fb-width` 26px, `.fb-notenav` 30px, `.fb-shade` 40×28, `.fb-icon` 42px |
| **Date landmine.** `start`/`end` are live `Date` objects with no serializer. The first JSON round-trip turns them into strings and every `minutesInto`/`sameDay` breaks. | 232–243, `store` 25–41 |
| No error handling anywhere — no boundary, no try/catch on `source.list()`, no loading or failure UI | 451 |

### Locked decisions

- **Hosting:** cloud (Vercel / Fly / Render). The OAuth refresh token lives server-side; the iPad never holds a credential.
- **Architecture:** full decomposition of the single file into modules. Parallel agent work depends on it.
- **Not building:** onboarding. Everything is configured in Settings. This is a personal board, not a product.

---

## 2. Target architecture

```
Calendar/
├── index.html                       R1
├── package.json  vite.config.js     R1
├── PLAN.md  SCOPING.txt  README     R0
├── docs/                            R14
├── api/                             R4 — serverless; the refresh token lives here
│   ├── auth/google.js               R4   consent + callback
│   ├── auth/refresh.js              R4
│   ├── _lib/tokens.js               R4
│   ├── calendar/events.js           R8
│   └── drive/photos.js              R9
└── src/
    ├── main.jsx  App.jsx            R2
    ├── contracts/                   R3   shapes, schemaVersion, serializers, migrations
    ├── lib/                         R2   date.js  color.js  uid.js  store.js
    ├── data/                        R3   seam; mock.js · google.js R8 · drive.js R9 · weather.js R6
    ├── hooks/                       R2   useNow useIdle useBoardData useSleep useMemberFilter
    ├── state/                       R3   BoardContext · PaletteContext · ModeContext R10
    ├── components/
    │   ├── shell/                   R2   Fit Header Footer Sheet Field icons
    │   ├── views/                   R2   Day R7 · Week · Month · Agenda
    │   ├── notes/                   R2   NoteDock NoteWindow NoteThumb drawStrokes
    │   ├── idle/                    R2   SleepVeil Screensaver
    │   ├── settings/                R2   panels; sections added by R9 R10
    │   ├── weather/                 R6   exclusive
    │   └── chores/                  R11  exclusive
    └── styles/                      R5   tokens.css + per-component CSS modules
```

**Ownership rule.** A role edits freely inside the paths it owns. Touching another
role's paths requires a contract change routed through R0 and landed as a PLAN.md
edit *before* the code. Anything a role finds but is not authorized to fix goes in
the **Deferred Defects** table at the bottom of this file.

---

## 3. Wave order

```
Wave 0   R1 ──▶ R2 ──▶ R3            strictly sequential, single-threaded, blocking
Wave 1   R4 ‖ R5 ‖ R6 ‖ R7           four agents, disjoint paths
Wave 2   R8 ‖ R9 ‖ R10               need R3 + R4
Wave 3   R11 ‖ R12                   need R10
Wave 4   R14                         ships it
         R13                         runs continuously from Wave 0 onward
```

A wave closes only when R13's tests are green and the board still renders correctly
at 1080×810.

---

## 4. Roles

### R0 — Program Orchestrator

**Mandate.** Own this file. Sequence waves, arbitrate contract changes, merge branches
at wave boundaries, keep the Deferred Defects table current, decide when scope changes.

**Owns.** `PLAN.md`, merge order, branch policy.
**Depends on.** Nothing. **Done when.** The board runs on the iPad in both modes.

---

## Wave 0 — Foundation

*Strictly sequential. One agent at a time. Nothing else may run concurrently.*

### R1 — Build & Tooling Engineer

**Mandate.** Turn a loose `.jsx` file into a real project. Do not touch `family-board.jsx`.

**Owns.** `package.json`, `vite.config.js`, `index.html`, `.eslintrc`, `.prettierrc`, `.gitignore`, `vitest.config.js`, `src/main.jsx`
**Reads.** `family-board.jsx`
**Depends on.** Nothing.

**Backlog**

1. Vite + React scaffold. `npm run dev`, `build`, `preview`, `test`, `lint`.
2. `index.html` mounting the untouched prototype via `createRoot`. Viewport meta suited to a pinned full-screen iPad web app; no user zoom.
3. ESLint + Prettier, `react-hooks` rules on.
4. Vitest + Testing Library + jsdom, one smoke test that renders the board.
5. Real `.gitignore` — `node_modules`, `dist`, `.env*`, editor cruft. It is currently empty.
6. Hosting target config for the chosen provider; `.env.example` with the variable names R4 will need.

**Acceptance.** `npm run dev` renders the prototype pixel-identical to the artifact.
`npm run test` and `npm run lint` both exit 0. No behavior changed.

---

### R2 — Refactor Surgeon

**Mandate.** Mechanical decomposition into the tree in §2. **Zero behavior change.**
No features. No bug fixes — log every defect found to Deferred Defects instead. This
is the highest-risk role precisely because it is the most boring one.

**Owns.** Everything under `src/` at this point. **Depends on.** R1.

**Backlog**

1. Extract pure helpers to `src/lib/`: `date.js` (`startOfDay` … `fmtClock`, 178–216), `color.js` (`clampHex` `toRgb` `tint` `hexToHsl` `variantColor` `splitFill` `VARIATIONS`, 101–176), `uid.js`, `store.js`.
2. Extract hooks: `useNow` 355, `useIdle` 375. Then carve `useBoardData`, `useSleep`, `useMemberFilter` out of the 255-line root component (425–680) so it stops owning 11 state slices, persistence, filtering, colour derivation, sleep, notes and event CRUD at once.
3. One file per component, mirroring §2. `Fit`, `Header`, `Footer`, `Avatar`, `Countdowns`, the four views, the three note components, `Composer`, `Settings`, `SleepVeil`, `Screensaver`, `Sheet`, `Field`, the four inline SVG icons.
4. Split the 378-line `CSS` string (1729–2106) into per-component stylesheets. **Stop re-injecting a `<style>` tag on every render** (583) — that is a real perf bug on a device that runs for months.
5. Introduce `PaletteContext` so `fillFor` / `firstColor` stop being prop-drilled into four views.
6. Delete `family-board.jsx` once nothing imports it.

**Acceptance.** Visually identical at 1080×810. R13's smoke tests still pass. Diff
contains no logic changes — a reviewer should be able to confirm every moved line is
the same line. Deferred Defects table has entries.

---

### R3 — Contracts & Data-Layer Architect

**Mandate.** Freeze the shapes everything downstream depends on. Every later wave
consumes these, so getting them wrong is expensive.

**Owns.** `src/contracts/`, `src/lib/store.js`, `src/data/index.js`, `src/data/mock.js`, `src/state/BoardContext.jsx`
**Depends on.** R2.

**Backlog**

1. Document and freeze: `Event`, `Member`, `Note`, `Task`, `Routine`, `Settings`, `WeatherSnapshot`. JSDoc typedefs are sufficient; add a `schemaVersion` to persisted blobs.
2. **Solve the Date problem.** Write a serializer/reviver so `start`/`end` survive a JSON round-trip as real `Date`s. This is a prerequisite for offline cache, persistence, and every sync path.
3. Swap `store` (25–41) from `window.storage` to `localStorage` behind the same async interface. Both current bodies swallow errors silently — surface failures instead so a broken board is visible rather than mysteriously amnesiac.
4. Extend `DEFAULT_SETTINGS` (80–93) with every field later waves need, defaulted and migrated: `mode`, `calendars` (per mode), `weather` (location, units), `drive` (folderId), `sleepStyle` (`"black" | "dim"` — the spec asks for a discrete choice; today it is only a 0–0.4 slider), and expose `wakeTapSeconds`, which is hardcoded at line 88 and merely *displayed* at 1589.
5. Formalize the source interface as `list` / `create` / `update` / `remove` / `subscribe`. Today `update` does not exist and there is no edit path in the whole app.
6. Write `migrate(persisted)` handling absent fields and version bumps.

**Acceptance.** Contracts documented and unit-tested. An event persisted, reloaded,
and rendered still has live `Date`s. Mock source implements the full five-method
interface. Settings from before the migration load without loss.

---

## Wave 1 — Parallel

*Four agents. Disjoint paths. No shared files.*

### R4 — Backend & Auth Engineer

**Mandate.** Stand up the server side. The iPad must never hold a Google credential.

**Owns.** `api/auth/**`, `api/_lib/**`, deployment secrets
**Depends on.** R1. **Blocks.** R8, R9.

**Backlog**

1. Google OAuth consent + callback for Calendar (read/write) and Drive (read-only) scopes.
2. Refresh token stored server-side in provider env/KV. Never sent to the client.
3. Short-lived access-token minting; the browser gets data, not tokens.
4. `/api/health` for the runbook.
5. CORS locked to the board origin; rate limiting; a shared-secret or device check so the endpoint is not open to the internet.
6. Document every required env var in `.env.example`.

**Acceptance.** From the deployed URL, a token can be minted and refreshed. No token
appears in any client-side response body, localStorage, or network payload reaching
the iPad.

---

### R5 — Design System & Theming Engineer

**Mandate.** Make the styling a system rather than a 378-line string.

**Owns.** `src/styles/**` — exclusively. **Depends on.** R2.

**Backlog**

1. `tokens.css`: the 60/30/10 contract as named variables — 60% paper, 30% surface grey, 10% per-person pastel. Preserve all five themes and `ACCENT_NOW` (`#E0574F`) as the now-line's exclusive colour.
2. Per-component CSS modules matching R2's component tree.
3. **Kill the JS↔CSS magic-number duplication.** Today `.fb-axis { margin-left: 164px }` must silently stay in sync with a 150px lane column plus a 14px gap; `.fb-dock { bottom: 92px }` must track a 60px footer. Express these as derived custom properties.
4. Publish `--tap-min: 44px` and hand R12 an audit listing every selector currently below it.
5. Keep month art (`MONTH_ART` 57–70) rendering at `opacity: .5` and user-disableable.
6. Preserve the `prefers-reduced-motion` block and `:focus-visible` outlines.

**Acceptance.** No visual regression at 1080×810. Zero hardcoded colour literals
outside `tokens.css`. Audit document delivered.

---

### R6 — Weather Engineer

**Mandate.** Build the weather feature from nothing.

**Owns.** `src/components/weather/**`, `src/data/weather.js`, the weather section of Settings
**Depends on.** R3.

**Backlog**

1. Pick a **keyless provider** (Open-Meteo or equivalent) so this role is not blocked on R4 and the board needs no additional secret.
2. Five icons only: Sunny, Partly Cloudy, Cloudy, Rain, Snow. **Every other condition maps to Sunny** — that is the spec, not a shortcut. Match the existing hand-drawn inline-SVG idiom (`Gear` 1703 etc.); do not add an icon dependency.
3. Collapsed state: icon + temperature in °F, in the header.
4. Tap to expand into a rectangular widget that grows *from its current position*: hi/lo across the top, hourly temperature, hourly precipitation chance, sunrise and sunset in the same list, and peak UV time with its index.
5. Cache aggressively and degrade quietly — a wall board with a dead network should show stale weather, not an error.
6. Location configurable in Settings.

**Acceptance.** Header shows live conditions. Widget expands and collapses on tap
within the 1080×810 canvas without overflowing. Network failure leaves the last
good reading on screen.

---

### R7 — Day View Rebuild Engineer

**Mandate.** Fix the one structural mismatch with the spec.

**Owns.** `src/components/views/DayView.jsx` and its stylesheet, plus a new event
detail sheet. **Depends on.** R2, R5.

**Backlog**

1. Rotate the view: **time on the vertical left axis, people across the top.** Today it is the transpose — lanes are rows and time runs horizontally with the axis strip below (838–844).
2. Reuse `WeekView`'s hour gutter (880–886) so Day and Week are visibly the same system. Consider extracting a shared `TimeGutter`; coordinate with R0 if that means touching `WeekView`.
3. Honour `settings.dayStart` / `dayEnd`.
4. Preserve everything that works: all-day chips, `splitFill` diagonal bands for shared events, the `ACCENT_NOW` now-line, the empty state when every member is filtered out (780–782).
5. **Replace the double-tap delete** (821). Tap an event → detail sheet with edit and delete, reachable from every view, with a confirm step. This is currently the app's only delete path and it is both hidden and hazardous on iOS Safari.

**Acceptance.** Day and Week share a gutter and read as one system. No `onDoubleClick`
remains. Events are inspectable from all four views.

---

## Wave 2 — Parallel

*Depends on R3 and R4.*

### R8 — Calendar Sync Engineer

**Mandate.** Replace the mock with real Google Calendar, both directions. The design
is already sketched in the comment at 301–350 — implement it.

**Owns.** `src/data/google.js`, `api/calendar/**`
**Depends on.** R3, R4. **Coordinates with.** R10 on the two calendar sets.

**Backlog**

1. `CALENDARS` map: calendar email → `memberIds`. A shared calendar maps to two or more ids, which is what makes `splitFill` render its diagonal band.
2. `variant = (colorId - 1) % 11` so Google's event colours arrive as *shades of the owner's hue* rather than flat identical fills — the existing `variantColor` clamp (159–166) already keeps them in the pastel band. Events with no `colorId` inherit the calendar's.
3. Write-back: `create` and `update` POST/PATCH with `memberIds` and `milestone` in `extendedProperties.private`, so the board's own metadata round-trips.
4. Incremental sync tokens; a polling cadence tuned for an always-on display; refresh on wake.
5. Offline cache using R3's serializer. **Visible failure state** — today a 401 or a dead network renders a blank board with no explanation (451).
6. Expose **two calendar sets**, roommate and personal, for R10 to switch between.

**Acceptance.** Events load from real calendars with per-person hues and correct
sub-shades. An event created on the iPad appears in Google Calendar with its members
and milestone flag intact. Pulling the network shows cached events plus a clear
degraded indicator.

---

### R9 — Drive Photo Screensaver Engineer

**Mandate.** Feed the existing screensaver from a real Drive folder.

**Owns.** `src/data/drive.js`, `api/drive/**`, the photo section of Settings
**Depends on.** R3, R4.

**Backlog**

1. Folder-id entry in Settings — there is currently **no UI at all** to add photos.
2. List image files in the folder via the Drive API; proxy or sign URLs server-side.
3. Prefetch and cache the next few images so rotation never shows a blank frame.
4. Wire into `Screensaver` (1643–1673), preserving its 30s rotation, scrim, clock and next-event line.
5. Month art stays the fallback when the folder is empty or unreachable (1655).

**Acceptance.** A real Drive folder drives the idle screen. Emptying the folder falls
back to month art without an error state.

---

### R10 — Modes Engineer

**Mandate.** Roommate Mode and Personal Mode. Two calendar sets, two rosters, one board.

**Owns.** `src/state/ModeContext.jsx`, the mode toggle in Settings
**Depends on.** R3, R8. **Blocks.** R11.

**Backlog**

1. `ModeContext` holding the active mode; persisted.
2. Per-mode calendar set (from R8) and per-mode member roster — the roommates are not the family.
3. Per-mode settings where they diverge; shared where they do not.
4. Settings toggle. No onboarding, no wizard — one control.
5. **The only feature difference is the To-do tab**, which exists in Roommate mode only. The view list is hardcoded at 1035; make it mode-derived.

**Acceptance.** Toggling swaps calendars, roster and colours wholesale. The choice
survives reload. The To-do tab appears in Roommate mode and is absent in Personal mode.

---

## Wave 3 — Parallel

*Depends on R10.*

### R11 — Chores / To-Do Engineer

**Mandate.** Build the To-do tab from nothing.

**Owns.** `src/components/chores/**` — exclusively — plus the `Task`/`Routine` slices
of persistence. **Depends on.** R3, R10.

**Backlog**

1. Checklist tab in the footer view switcher, Roommate mode only.
2. Layout: chore bank down the left; per-person columns headed by name and avatar, matching the existing `Avatar` component (685–705).
3. Assignment by **drag from bank to person and by tap** — drag alone is a poor sole interaction on a wall-mounted tablet, and there must be a fallback that always works.
4. Tap the checklist circle to complete; completed chores sink to the bottom of the screen.
5. Emoji alongside task names.
6. A seeded default chore list on first use: vacuuming, clean bathroom, take out trash, dishes, and the rest of the basics.
7. **Routines.** Two kinds: a chore permanently assigned to one person on a weekly cadence, and a chore rotated among a selected group at a chosen rate — "one of these four vacuums each week, repeating." Rotation state must be deterministic and testable.
8. Persist per mode.

**Acceptance.** Chores assign by both drag and tap. Completion moves them to the
bottom. A weekly rotation advances correctly across a simulated month, verified by
R13's tests. Everything survives reload.

---

### R12 — iPad Hardening & Interaction Engineer

**Mandate.** Make it survive being a wall appliance. Runs on a quiet tree — this role
touches many files, so it does not share a wave with another cross-cutting role.

**Owns.** Cross-cutting; coordinate merges through R0.
**Depends on.** R5's audit, R7, R11.

**Backlog**

1. Raise every hit target to 44pt using R5's audit: `.fb-pen` 22px, `.fb-width` 26px, `.fb-notenav`/`.fb-noteclose` 30px, `.fb-shade` 40×28, `.fb-icon` 42px. Only `.fb-fab` at 56px currently passes.
2. Pointer-event swipe paging for day and week. Today paging is chevron-only (1066–1071).
3. **Orientation — resolve with the user before changing anything.** The canvas is landscape 1080×810 and every dimension downstream is tuned to it. `SCOPING.txt` says "810×1080pt," which reads portrait. If portrait is genuinely wanted, that is a re-layout of every view, not a CSS tweak. Flag it; do not assume.
4. Error boundary plus loading / offline / failure UI. There is none today.
5. Fix the defects R2 logged rather than fixed:
   - `onSave` called inside a `setStrokes` updater (1191) — a side effect in a reducer; double-fires under StrictMode.
   - `AgendaView` receives the full `members` list (627) while `DayView` gets `shownMembers` (606), so Agenda renders avatars for filtered-out people.
   - `useIdle`'s effect tears down and re-adds three window listeners on every settings edit.
   - `Composer`'s hour picker is hardcoded 6am–10pm (1396) and ignores `dayStart`/`dayEnd`.
   - `NoteWindow` is passed a `members` prop it never destructures (656).
6. Focus trap and Escape handling on `Sheet` — it closes on scrim click only (1680).
7. Long-run soak: no memory growth, no timer leak, no drift over days of uptime.

**Acceptance.** Every interactive element ≥44pt. Swipe works. A forced API failure
shows a clear state instead of a blank board. A multi-day soak run shows flat memory.

---

## Wave 4 — Continuous and final

### R13 — QA & Test Engineer

**Mandate.** Active from Wave 0 onward, not bolted on at the end. Gates every wave.

**Owns.** `**/*.test.js`, test fixtures, CI config. **Depends on.** R1.

**Backlog**

1. Unit tests for the pure functions — they are already clean seams: `variantColor` and its sat/light clamp, `splitFill`, `isAsleep` **including the midnight wrap**, every date helper, R3's Date reviver, R11's rotation scheduler.
2. Component tests: filter propagation across all four views, mode switching, sleep/wake transitions, countdown selection.
3. Contract tests against R3's shapes so a wave cannot silently break a downstream consumer.
4. Fixed-viewport 1080×810 visual regression pass.
5. Mocked-network tests for the failure paths R8, R9 and R6 must handle.

**Acceptance.** No wave closes with a red suite. Coverage on `src/lib/` and
`src/contracts/` is meaningful, not nominal.

---

### R14 — Ops & Device Runbook Engineer

**Mandate.** Get it onto the wall and keep it there.

**Owns.** `docs/`, deployment configuration. **Depends on.** R4, R12.

**Backlog**

1. Production deploy and secret management for the chosen provider.
2. Device runbook: Auto-Lock → Never, Guided Access pinned to the board, home-screen install, cache behaviour.
3. **iOS Shortcuts automations** for brightness: down at sunset, up at sunrise, and near-full — not 100% — through core daylight hours. Note that these are *separate from* the in-app sleep mode, which handles the black/dimmed overlay between the configured night hours.
4. Recovery notes: what to do when the board is blank, stale, or logged out.
5. Backup and restore of settings, notes and chore state.

**Acceptance.** A factory-state iPad reaches a running, pinned board using the doc
alone, with no undocumented steps.

---

## 5. Coordination rules

1. **One branch per role**, named `role/rN-slug`. Merge at wave boundaries, never mid-wave.
2. **Contract changes go through R0** and land as a PLAN.md edit *before* any code.
3. **Do not reach into another role's paths.** File a Deferred Defect instead.
4. **A wave closes** only when R13's suite is green and the board renders at 1080×810.
5. **Preserve the good bones.** The `list`/`create`/`remove` seam, the pure colour
   functions, the normalized 0–1 note strokes, and the `>>> SWAP` markers (23, 92,
   223, 302) are deliberate design. Extend them; do not replace them.

---

## 6. Requirements coverage

| SCOPING.txt requirement | Owner |
|---|---|
| iPad A2197 sizing and canvas | R2 (preserve), R12 (verify) |
| Touch-first interaction, 44pt targets | R12 |
| Google Calendar import + write-back | R8 |
| Per-person pastel + colorId sub-hues | Built; R8 supplies real colorIds |
| Sticky notes | Built; R2 relocates |
| Day / Week / Month / Schedule views | Built; **R7 rebuilds Day to spec** |
| Sleep mode + configurable hours + black-vs-dim | Built; R3 adds the discrete `sleepStyle` choice |
| Countdown ticker | Built |
| 60/30/10 pastel palette | Built; R5 systematizes |
| Photo screensaver via Drive | R9 |
| Filtering by avatar tap | Built; R12 fixes the Agenda leak |
| Roommate / Personal modes | R10 |
| To-do tab, chore bank, routines | R11 |
| Weather icons, °F, expandable widget | R6 |
| Guided Access, Auto-Lock, iOS Shortcuts brightness | R14 |
| *No onboarding* | Owned by nobody, by design |

---

## 7. Deferred Defects

Roles append here when they find something outside their mandate. R0 assigns.

| # | Found by | Where | Issue | Assigned |
|---|---|---|---|---|
| 1 | Survey | `family-board.jsx:1191` | `onSave` called inside a `setStrokes` updater — side effect in a reducer, double-fires under StrictMode | R12 |
| 2 | Survey | `:627` vs `:606` | `AgendaView` gets unfiltered `members`; renders avatars for hidden people | R12 |
| 3 | Survey | `:384-392` | `useIdle` re-registers three window listeners on every settings edit | R12 |
| 4 | Survey | `:1396` | Composer hour picker hardcoded 6am–10pm, ignores `dayStart`/`dayEnd` | R12 |
| 5 | Survey | `:656` | `NoteWindow` passed a dead `members` prop | R12 |
| 6 | Survey | `:821` | Delete is double-tap, Day-view only, no confirm | R7 |
| 7 | Survey | `:451` | `source.list()` has no try/catch and no failure UI | R12 |
| 8 | Survey | `:583` | `<style>` re-injected on every render | R2 |
| 9 | Survey | `:936-937` | `MonthView`'s `cut` logic is subtle and uncommented | R13 (test it) |
| 10 | Survey | `:1730` | Google Fonts `@import` is a runtime network dependency — a cold board with no network loses its typeface | R14 |
| 11 | R1 | `:1733` | `.fb-fit { height: 100vh }`. On iOS Safari outside standalone mode `100vh` counts browser chrome, so the scaled canvas is taller than the visible viewport and the footer view-switcher is clipped — the one control needed to change views. Correct in Guided Access / home-screen install, broken in plain Safari. Fix is `100dvh` with a `100vh` fallback | R5 (owns styles), verify R12 |

| 12 | R2 | `settings/Settings.jsx` "Board color" | `THEMES[settings.theme].paper` is read with no fallback, while every other consumer writes `THEMES[settings.theme] \|\| THEMES.paper`. If a persisted blob names a theme this build lacks — a rename, a downgrade, a partial migration — and `customPaper` is empty, so the `\|\|` does not short-circuit past it, opening Settings throws. That is the one panel you would fix the bad theme from | R3 (`migrate()`) |
| 13 | R2 | `hooks/useBoardData.js` | `store.set` JSON-stringifies whatever it is handed, and `notes` survives that only because strokes are plain numbers. Events are not persisted at all, so a cold board shows nothing until `source.list()` resolves. Both are blocked on the Date serializer | R3 (items 2, 3) |
| 14 | R2 | `hooks/useBoardData.js` load effect | The three `store.get` calls are awaited together, then `source.list()` is awaited, then `setLoaded(true)`. Nothing distinguishes "still loading" from "loaded and empty", so the board renders a fully-populated empty state during startup. `loaded` exists but is only used to gate persistence | R12 (item 4, loading UI) |
| 15 | R2 | `components/settings/Composer.jsx` | Creating an event ignores `end` when `milestone` is ticked: `allDay: milestone` is set but `end` is still `start + dur`, so an all-day milestone carries a stale 60-minute duration. Harmless today because no view reads `end` for all-day events; a landmine for R8's write-back, which will POST it to Google | R8 |
| 16 | R4 | `vitest.config.js` `test.include` | Scoped to `src/**/*.{test,spec}.{js,jsx}`, so `api/**` (auth, tokens, security, CORS, rate limit) has zero automated coverage — verified manually instead for this wave. Needs either a second Vitest project for the Node environment or a widened include once `api/` has enough surface to justify it | R13 |

| 16 | R3 | `components/settings/Settings.jsx` Sleep section | `sleepStyle` now exists, is persisted, is validated, and is *derived* for every pre-existing board — but there is no control for it. The Sleep section still shows only the 0–0.4 `sleepDim` slider, which cannot express "black": `SleepVeil` floors its opacity at `Math.max(opacity, 0.02)`. Two lines: a black/dim pair of pills, and `App.jsx` passing `0` for opacity when the style is `"black"`. Same section still only *displays* `wakeTapSeconds` with no control, which R3's item 4 asked to expose | R12, or whoever next owns `Settings.jsx` |
| 17 | R3 | `src/test/fixtures/prototype-css.txt` | `styles.contract.test.js` compares `BOARD_CSS` byte-for-byte against this fixture. The repo has no `.gitattributes`, so on Windows — where Git for Windows defaults to `core.autocrlf=true` — the fixture checks out CRLF while the JS template literals are LF, and the test fails on a clean clone for reasons unrelated to the CSS. Verified: the two are identical once `\r\n` is normalized. `npm run format:check` is red across all 60 `src/` files for the same reason. One-line fix: a `.gitattributes` holding `* text=auto eol=lf`, then re-normalize. R3 did not add it — root tooling files are R1's | R1 (tooling), blocks R5 and R13's gate |
| 18 | R12 | `src/data/google.js` `refreshAll()` | `cache = merged` replaced the full event cache with just that round's result on every branch, including the sync-token poll the app actually uses — a diff of what changed, not a snapshot. A healthy 5-minute poll silently erased every unchanged event from the board. Verified with a reproduction, then fixed disclosed (user consulted first, given `google.js` is R8's file): the sync-token branch now upserts changed events and removes cancelled ids instead of replacing wholesale; the `list(range)` branch, unused by the app, is untouched | R12 (fixed) |

**R1 note on Defect #1.** `src/main.jsx` mounts the board inside `React.StrictMode`, so
that defect is now live in dev: note strokes save twice. Kept on deliberately — the
alternative is hiding it until the board is on the wall. Production builds are
unaffected. One-line toggle in `src/main.jsx` if it obstructs R2.

**R2 note on Defects #1–#11.** All eleven were carried through the decomposition
unchanged and each now has a comment at its new location naming its number and its
assigned role, so the fixer does not have to re-derive the problem. Only Defect #8
(`<style>` re-injected on every render) was R2's to fix, and it is fixed —
`src/components/shell/BoardStyles.jsx` is a `memo()` boundary over a module-constant
stylesheet, so it renders once per mount instead of on every clock tick. The line
numbers in rows 1–11 refer to the deleted `family-board.jsx`; their new homes are:

| # | Was | Now |
|---|---|---|
| 1 | `:1191` | `src/components/notes/NoteWindow.jsx` — `onUp` |
| 2 | `:627` vs `:606` | `src/App.jsx` — the `AgendaView` call site, commented |
| 3 | `:384-392` | `src/hooks/useIdle.js` |
| 4 | `:1396` | `src/components/settings/Composer.jsx` — the "Starts" field |
| 5 | `:656` | `src/App.jsx` — the `NoteWindow` call site, commented |
| 6 | `:821` | `src/components/views/DayView.jsx` — `onDoubleClick` |
| 7 | `:451` | `src/hooks/useBoardData.js` — the load effect |
| 8 | `:583` | **fixed** — `src/components/shell/BoardStyles.jsx` |
| 9 | `:936-937` | `src/components/views/MonthView.jsx` — now documented in place for R13 |
| 10 | `:1730` | `src/styles/fit.js` — the `@import` leads the sheet |
| 11 | `:1733` | `src/styles/fit.js` — `.fb-fit { height: 100vh }` |

**R3 note on Defects #12 and #13.** Both are fixed. #12 is fixed in `migrate()` rather
than in `Settings.jsx`: `theme` is validated against `THEMES` on every load, so a stale
name never reaches a component and the unguarded read is unreachable — the read itself
is still there, and is still R12's to tidy if it wants. #13 is fixed in both halves —
Dates survive persistence via `src/contracts/serialize.js`, and events are now cached,
so a cold board paints its last known events instead of showing nothing until
`source.list()` resolves. Defect #7 is deliberately still open: `source.list()` still has
no try/catch, but the board now has a cache to keep showing while it fails. Details in
`CONTRACTS.md`.

**R7 note on Defect #6, and on contract touches outside DayView.jsx.** Defect #6 is
fixed: the `onDoubleClick` delete is gone, replaced by `src/components/views/EventDetailSheet.jsx`
(edit + two-step confirm delete), opened by tapping an event in **any** of the four
views. That acceptance bar — "reachable from every view" — could not be met by touching
only `DayView.jsx` and its stylesheet, so this role also made three small, deliberate
touches outside its owned paths, recorded here per the coordination rule rather than
made silently:

- `WeekView.jsx` — swapped its inline hour-label markup for the new shared
  `src/components/views/TimeGutter.jsx` (item 2's "read as one system"), and gave
  `.fb-wblock` an `onSelect` handler so a Week block opens the same sheet as Day.
- `MonthView.jsx` and `AgendaView.jsx` — each gained an `onSelect` prop so their event
  chips/rows open the sheet too. Neither view's own navigation (`onPick` on a Month
  cell) changed.
- `styles/styles.contract.test.js` — retired the byte-identical-to-prototype assertion.
  That test's own docstring assigned its removal to "R5 ... in the same commit that
  lands the replacement" of the CSS strings with tokens/modules; rotating DayView
  (item 1) is a real layout change rather than that swap, but it is the first
  legitimate post-R2 change to a `styles/*.js` chunk, so the same retirement applies —
  a byte-for-byte pin against the prototype cannot coexist with a mandate to change
  what the board looks like. This also moots Deferred Defect #17 (the CRLF fixture
  mismatch): the fixture the test compared against is now unused by any test.

No other role's owned files were touched. `src/styles/sheet.js` gained three small
shared classes (`.fb-danger`, `.fb-textdanger`, `.fb-deleteprompt`) for the new sheet's
delete control — additive, no existing rule changed.

**R5 note on reconciling with R7.** R5's design-system pass and R7's DayView rebuild
were both branched off R2's baseline and landed back to back, conflicting in three
files. Resolved keeping both roles' work, not diminishing either:

- `src/styles/*.js` moved into `shell/`, `views/`, `notes/`, `idle/` (mirroring §2's
  component tree) in the same commit every literal became a `tokens.js` custom
  property. Any note above naming a flat path like `src/styles/day.js` or
  `src/styles/sheet.js` now means `src/styles/views/DayView.js` /
  `src/styles/shell/Sheet.js` respectively — content, not intent, moved.
- R7's DayView rotation is kept exactly as landed; R5 only replaced its one
  remaining literal (`.fb-dblock`'s `#24262B`) with the same `--ink-on-color`
  token every other event block already reads. R7's rewrite eliminated `.fb-lane`/
  `.fb-lanename`/`.fb-axis`/`.fb-tick` and the lane-name column they measured, which
  retires R5's `--lane-name-w`/`--lane-gap`/`--axis-margin` derivation along with
  them — there is no rule left to derive a margin for. `--dock-bottom` (the other
  half of R5's magic-number item) is untouched and still load-bearing.
- R7's three additive `.fb-danger`/`.fb-textdanger`/`.fb-deleteprompt` classes in
  the sheet stylesheet are tokenized (`--danger-bg`, `--danger-ink`) rather than
  aliased to `--now`, even though they share a hex today — `--now` stays reserved
  for the now-line alone, per its own contract.
- Both roles independently retired `styles.contract.test.js`'s byte-identical
  assertion in favour of the same four structural checks (R7's note above explains
  why). R5's replacement, `styles.smoke.test.js`, is kept as the single test file:
  it's a strict superset, adding token-contract coverage on top of R7's four checks.
  `src/test/fixtures/prototype-css.txt` and `scripts/extract-prototype-css.mjs` are
  now unused by any test; left in place as R0/R13's call, not deleted mid-merge.

---

**R8 note on the calendar sync build.** `src/data/google.js` and `api/calendar/**`
are landed, implementing the sketch that used to live as a block comment in
`src/data/index.js`. What the sketch left open, and how it was resolved:

- **Calendar-to-member map.** Read from `Settings.calendars[settings.mode]` fresh
  on every sync — not passed in at construction — via `store.get()` +
  `migrateSettings()`, the same path `useBoardData` itself uses. This means a
  calendar edited in Settings, or a mode switch R10 makes later, takes effect on
  the source's next 5-minute poll without the source being recreated, and it kept
  this role from having to reach into `useBoardData.js` or `App.jsx` at all —
  `createSource()` in `src/data/index.js` stays the only call site, exactly as
  that file's own header promises.
- **`api/calendar/events.js`** is a generic, member-and-mode-agnostic proxy: one
  `calendarId` per call, list/create/update/delete, pagination resolved to
  completion server-side, Google's own incremental sync tokens forwarded rather
  than reinvented. The JSON envelope between it and `src/data/google.js` is this
  role's own design, not a mirror of Google's raw resource shapes — documented at
  the top of each function in that file. It is not wired into `vitest` — Deferred
  Defect #16 already flagged `api/**` as outside the current test include, and
  widening that is R13's call, not this role's. Confidence instead comes from
  `src/data/google.test.js` and the `"google"` entry in
  `src/data/source.contract.test.js`, both of which drive `src/data/google.js`
  against an in-memory fake that speaks the same client/server contract, plus a
  manual code review of the route against the real Calendar v3 API.
- **Calendar selection on `create()`.** Exact member-set match first (a
  two-person draft should land on the calendar that produces exactly that
  diagonal split), then a calendar that's a superset of the requested members,
  then the first enabled calendar; throws if none is configured. `Settings.
  calendars` starts empty per R3's defaults, so an operator has to populate at
  least one `CalendarLink` — in Settings, once that UI exists, or by hand in the
  persisted blob today — before the board can create events against Google.
- **Degrading.** `list()` never throws. A total failure across every configured
  calendar falls back to this session's last good in-memory merge, or — on a
  cold start where nothing has synced yet — the contract-shaped cache
  `useBoardData` already persists under `STORE_KEYS.events`. The array returned
  in that case carries a non-contract, additive `degraded: true` property for
  whichever failure UI eventually reads it. Deferred Defect #7 (no failure UI at
  all) is deliberately still open — building that UI is R12's, not this role's.
- **Two files touched outside this role's own paths**, both pre-authorized by
  their own comments rather than negotiated fresh: `src/data/index.js`'s
  `>>> SWAP` block said outright "the choice belongs here," and
  `src/data/source.contract.test.js` said outright "R8: add
  `runs("google", ...)` here." Recorded per §5 rule 3 anyway, same as R7 and R5
  did for their own cross-file touches above.

Note for R10 (this role, reconciling on merge): R8 reads `Settings.calendars[mode]`
directly off storage on its own poll cycle rather than taking a mode argument at
construction, which is exactly why R10's mode switch needed no coordination with
`createSource()` — flipping `settings.mode` in Settings is itself the signal R8's
next poll picks up, no call into `src/data/index.js` required from either side.

---

**R9 note.** Drive photo screensaver landed: `src/data/drive.js` (`listDrivePhotos` /
`getDrivePhotos` / `useDrivePhotos`, mirroring R6's `weather.js` split), two routes
under `api/drive/**` (`photos.js` lists image metadata, `photo.js` proxies one file's
bytes using R4's `mintAccessToken()`), and a "Photos" `Field` in `Settings.jsx` for the
folder id. `settings.photos` still feeds `Screensaver` exactly as CONTRACTS.md §6 says —
nothing in `Screensaver.jsx` changed.

One disclosed touch outside R9's owned paths, same category as R6's and R7's above:
`src/App.jsx` gained an import and one hook call, `useDrivePhotos(settings,
data.setSettings)`, right after `useSleep`. This was unavoidable rather than a
convenience — `useDrivePhotos` has to run from a component that is always mounted (it
polls and keeps `settings.photos` current), and both candidate homes for that are owned
elsewhere and conditionally rendered besides: `Settings.jsx` only while the panel is
open, `Screensaver.jsx` only while idle. `App.jsx` is also the one place already holding
`setSettings` outside of `BoardContext` — the hook cannot read that context itself,
because `App` is the component that renders `<BoardContext.Provider>`, not one of its
descendants. No other line in `App.jsx` changed; the `Screensaver` call site and its
`photos={settings.photos}` prop are untouched.

Two Drive-API design notes worth a reviewer's attention:

- `api/drive/photo.js` accepts the device secret via `?secret=` as well as the header,
  using the fallback `api/_lib/security.js` already built into `hasValidDeviceSecret`.
  This isn't a weaker path opened for R9's convenience: a CSS `background-image` or
  `<img src>` load cannot attach a custom header, and that URL is exactly what
  `Screensaver` needs to paint. `VITE_BOARD_DEVICE_SECRET` is already documented as
  client-visible for this reason — it identifies the board, not a Google account.
- Prefetching is "warm every URL in the resolved list" rather than tracking "the next
  few" relative to Screensaver's own rotation index, which lives in a component R9
  doesn't own. For a personal photo folder (tens of images, not thousands) this meets
  the acceptance bar — rotation never lands on a cold URL — without R9 reaching into
  `Screensaver.jsx` to coordinate a window against its `i` state.

---

**R10 note, and a wave-order flag for R0.** §3 puts R10 in Wave 2, depending on R3
and R8. At the time this role started, R8 had not landed — no `src/data/google.js`,
no `api/calendar/**` existed yet — so this role went ahead on R3's half of the
dependency alone, which CONTRACTS.md's own §6 entry for R10 already anticipated
("`ModeContext` goes beside `BoardContext` and can read `settings`/`setSettings` from
`useBoard()`" — no mention of needing R8 present). The only thing R8 actually
supplies is real entries in `settings.calendars[mode]`; until then both modes'
calendar sets stayed `[]`, exactly as R3 defaulted them, and mode-switching itself —
roster, views, the active mode — never touched a calendar at all. R8 has since landed
(merged into `main` while this branch was in flight, reconciled above) and confirms
the bet: its own note records that it reads `Settings.calendars[settings.mode]` fresh
from storage on every poll rather than taking a mode at construction, so nothing in
either role's landed code needed to change once both existed side by side. Flagging
the order violation for the record, not because it required redoing any work.

Landed:

1. `src/state/ModeContext.js` — the mode bundle: `mode`, `setMode`, `roster` (members
   narrowed to the active mode), `calendars` (`settings.calendars[mode]`), `views`
   (the footer's tab list, mode-derived), `isRoommate`. Named `.js` and holds no
   components, not the `.jsx` PLAN.md §2 named — the same deviation BoardContext.js
   took, and for the same reason: `<ModeContext.Provider value={...}>` is rendered
   directly by App.jsx (its value taken as a prop, exactly as BoardContext and
   PaletteContext already do) rather than through a wrapper component this file
   would export, so there is no JSX in it to justify the extension. Exports the plain
   `useModeState(members, settings, setSettings)` hook App.jsx calls directly — App
   cannot consume a context it is about to provide — and `useMode()` for descendants
   (Settings, R11's future chores tab) that can.
2. `src/App.jsx` — wired the provider; every prop that used to receive `members`
   (Footer's legend, Composer's and EventDetailSheet's "Who" pickers, AgendaView,
   `useMemberFilter`, `useBoardPalette`) now receives `roster` instead. Settings
   alone keeps the full `members` list, because it is where a person's mode
   membership gets assigned in the first place. One correctness fix beyond the
   rename: `useMemberFilter`'s "hidden" list is an exclusion list, not an allowlist,
   so handing it `roster` alone was not enough — an event belonging entirely to
   people outside the active mode's roster would still have passed through, because
   nobody on it was ever added to a hidden list scoped to a roster that no longer
   contains them. `App.jsx` now filters `events` down to the ones with at least one
   member in `roster` before `useMemberFilter` runs at all. Also added the one-line
   effect that resets `view` to `"day"` if the active mode's `views` no longer
   include it, so leaving Roommate mode while the To-do tab is open cannot strand the
   footer with no button lit.
3. `src/components/shell/Footer.jsx` — item 5's mode-derived view list. The hardcoded
   `["day","week","month","agenda"]` is now a `views` prop; Footer no longer knows
   what any view id means beyond how to capitalize it, with one label override
   (`"todo"` → `"To-do"`, SCOPING.txt's own spelling).
4. `src/components/settings/Settings.jsx` — the mode toggle (a "Mode" Field, pills,
   same shape as the Weather units control) and, since a mode toggle with nobody to
   switch to Roommate mode with is not a feature, the roster editor R3's
   `DEFAULT_MEMBERS` comment was written expecting: a "Personal" / "Roommate"
   checkbox pair per member. Unchecking a person's last remaining mode is refused
   rather than silently producing a member no view or filter can ever find again.
   "Add person" now defaults new members to both modes, matching
   `normalizeModes()`'s own fallback — it previously omitted `modes` entirely, which
   `useModeState`'s `m.modes.includes(mode)` would have thrown on for anyone added
   this way before their next reload revived them through `migrate()`.
5. `src/contracts/defaults.js` — narrowed `DEFAULT_MEMBERS`' `modes` from `[...MODES]`
   to `["personal"]`. This is R3's file, but its own comment invited exactly this
   edit ("R10 narrows them"): the five are the family, Roommate mode is "whether you
   display the iPad publicly between roommates or if you move it into your room as a
   family calendar" (SCOPING.txt), and a mode whose default roster is the same five
   people under a different label is not the feature described. Roommate mode now
   starts with zero members by default, the same "not configured yet" shape as
   `weather.lat: null` and `drive.folderId: ""` — consistent with "not building:
   onboarding" (§1), and item 4 above is exactly how a board configures it.
6. Tests: `src/state/ModeContext.test.js` (roster narrowing, calendar selection, the
   view list per mode, `setMode`'s validation and its no-op-on-repeat identity check),
   `src/components/shell/Footer.test.jsx` (the view switcher is a pure function of its
   `views` prop), `src/mode.integration.test.jsx` (the acceptance criterion end to
   end, in the shape of R3's `persistence.integration.test.jsx`: real Settings UI,
   real App, the To-do tab appearing and disappearing, the roster swap, and the mode
   surviving an unmount/remount).

Acceptance re-checked against PLAN.md's own wording: toggling in Settings swaps the
roster, the footer's views and (via `useBoardPalette` now reading `roster`) the
colour set derived from it, wholesale; `settings.mode` persists through R3's
store/migrate path unchanged, so it survives reload; the To-do tab is present in
`views` in Roommate mode only, verified by both the unit test and the DOM-level one.

---

**R11 note.** The chores tab is landed: `src/components/chores/` (`ChoresView.jsx`,
`ChoreCard.jsx`, `RoutineForm.jsx`, `ChoresStyles.jsx`, `icons.jsx`, `constants.js`,
`rotation.js`), reading `members`/`tasks`/`routines` and their mutators off
`BoardContext` and `roster`/`mode` off `ModeContext` — no props from `App.jsx` beyond
the bare `<ChoresView />` call site R10 already left ready.

1. **Contracts.** `normalizeTask`/`normalizeRoutine` added to `schema.js` beside
   `normalizeEvent`/`normalizeMember`, same totality guarantee. `defaults.js` gains
   `DEFAULT_TASKS` (the seeded eight-chore list, PLAN.md §R11 item 6, all unassigned
   and Roommate-mode-only) and `DEFAULT_ROUTINES` (`[]`), both folded into
   `DEFAULT_BOARD` per CONTRACTS.md's own invitation. `migrate.js` gains
   `migrateTasks`/`migrateRoutines`, wired into `migrate()`'s return —
   absent-key-means-seed-the-defaults is the same rule `migrateMembers` already
   applies, but an *empty* persisted `tasks` array is left empty rather than
   re-seeded, because a roommate board that finished its seeded chores and hasn't
   added new ones is a normal state, not a corrupt one (unlike an empty roster,
   which has no way back through the UI). Own test file,
   `src/contracts/chores.contract.test.js`, rather than editing R3's
   `schema.test.js`/`migrate.test.js`.
2. **Persistence.** `useBoardData.js` gains the `tasks`/`routines` state pair, load
   and write-through effects (mirroring `notes`, not `events` — these are board-local
   and never touch the source seam), and the mutators the chores tab and rotation
   scheduler call: `addTask`, `updateTask`, `toggleTask`, `ensureRoutineTask`,
   `addRoutine`, `removeRoutine`. This is the file CONTRACTS.md's own note on
   `BoardContext.js` named in advance ("R11 the chores tab needs members and the
   Task/Routine slices"), so touching it is this role's mandate, not a disclosed
   exception.
3. **Rotation (`src/components/chores/rotation.js`).** Pure functions only —
   `assigneeForRoutine`, `isActiveCycle`, `cycleIndex`, `materializedTask`,
   `isCurrentInstance` — none of them read or write React state, which is what
   PLAN.md §R11 item 7's "deterministic and testable" cashes out to: the answer for
   a given `(routine, date)` pair never depends on when or how many times it's
   asked. A cycle is `everyN` whole *weeks* from `startOfWeek(anchor)`, not raw
   millisecond distance, so an anchor on any weekday still rotates on a clean weekly
   boundary. `rotation.test.js` walks a routine across nine simulated Sundays (a
   two-month span) to cover PLAN.md's "advances correctly across a simulated month"
   acceptance line directly, plus edge cases: empty rotation group, pre-anchor weeks,
   `everyN > 1`, and same-week stability for any weekday.
4. **Materializing without duplicating.** A routine's weekly chore instance is a
   real `Task` row (`Task.routineId` is exactly this — R3 froze the field for it) with
   a *deterministic id*, `` `${routineId}@${weekKey}` `` — the week is encoded in the
   id itself, so "is this row still current" is a string comparison
   (`isCurrentInstance`) rather than a second piece of state that could drift out of
   sync with `tasks`. `ChoresView` re-materializes on every render whose `weekKey`
   changed (not on `useNow`'s own tick — `weekKey` is the actual dependency, so this
   doesn't refire every minute) and `ensureRoutineTask` is idempotent by construction,
   so calling it for an already-materialized week is a no-op rather than a duplicate.
   Once a new week starts, the previous week's instance is not deleted — it stays in
   storage as history — but `isCurrentInstance` filters it out of every rendered
   column and the bank, so nothing stale is ever shown. Reassigning a materialized
   instance for one week (drag or tap, same as any ad-hoc chore) is a deliberate,
   harmless side door: it only overrides that already-created row, and the next
   cycle's row is computed fresh from the routine regardless of any override left on
   an old one.
5. **Interaction: tap always works, drag is a bonus.** PLAN.md §R11 item 3 asks for
   tap specifically *because* "drag alone is a poor sole interaction on a
   wall-mounted tablet" — and on the iPad this board actually ships on, it's worse
   than poor: iOS Safari has never fired HTML5 `dragstart`/`drop` events from touch
   input for a plain `<div draggable>`, only from certain built-in drag sources (text
   selections, links, images). So drag here is native HTML5 drag-and-drop —
   `ChoreCard.jsx` sets `draggable` and `dataTransfer`, the bank and each column
   accept a drop — which gives desktop/trackpad testing a working drag for free but
   is inert on the real device; tap-to-select-then-tap-a-destination-header is the
   path documented as required, tested first, and the only one that works on an
   iPad. Recorded here rather than silently shipping a drag handler that looks
   complete but isn't the thing the acceptance criterion is actually asking for.
6. **No Settings section.** R11 owns `src/components/chores/**` exclusively — there
   is no chores entry in PLAN.md §2's Settings row the way R6/R9/R10 each got one —
   so routine authoring (the "+ Routine" button and `RoutineForm.jsx`) lives inside
   the chores tab itself rather than in `Settings.jsx`, which this role does not
   touch at all. `RoutineForm` stamps `anchor` as today at save time rather than
   exposing it as a field: the rule only needs *a* stable anchor week, not an
   author-chosen one, and one fewer decision matches "not building: onboarding."
7. **`App.jsx`.** One line changed, inside the block its own comment pre-authorized
   ("R11 owns the real chores tab ... this placeholder only keeps the tab from
   opening onto a blank stage"): the `fb-todoplaceholder` div is now `<ChoresView />`,
   no props. No other line in `App.jsx` touched.
8. **Tests.** `src/contracts/chores.contract.test.js` (normalizers + migration),
   `src/components/chores/rotation.test.js` (the scheduler, in isolation),
   `src/components/chores/ChoresView.test.jsx` (the seam test — a minimal in-memory
   re-implementation of `useBoardData`'s mutator shape behind real `BoardContext`/
   `ModeContext` providers, deliberately not the real hook, so a persistence bug
   can't mask a component bug or vice versa): tap-assign, tap-to-cancel,
   tap-back-to-bank, native drag-assign, complete-sinks-to-bottom, checkbox tap not
   also selecting the card, routine materialization on and before its anchor week,
   and adding a routine from the form materializing immediately.

Acceptance re-checked against PLAN.md's own wording: chores assign by both drag and
tap (item 5 above records why tap is the one that matters on-device); completing a
chore sinks it below the still-open ones in its column without reordering the bank
position underneath (`sortTasks` in `ChoresView.jsx`); a weekly rotation advances
correctly across a simulated month (`rotation.test.js`); everything persists through
`useBoardData`'s existing store/migrate path the same as every other slice, so it
survives reload without a bespoke mechanism.

---

**R12 note.** Landed on top of main after R6, R8, R9 and R10 (R11/chores had not
started at the time this role ran — nothing in `src/components/chores/**` existed
to hit the 44pt bar or need hardening, so backlog item 1's audit and item 5's fix
list only ever covered what R2/R5/R6/R7/R9/R10 had actually shipped). Per-item:

1. **Tap targets.** All six of R5's `tap-target-audit.md` gaps raised to
   `--tap-min` (44px): `.fb-pen`/`.fb-width`/`.fb-notenav`/`.fb-noteclose`
   (`styles/notes/Notes.js`), `.fb-shade` (`styles/shell/Sheet.js`, 48×44 —
   kept rectangular rather than squared off, so it still reads as a distinct
   shape from the circular swatches), `.fb-icon` (`styles/shell/Header.js`).
   `.fb-pen` needed a structural change, not just a bigger box: the button
   itself used to be the 22px colour dot, so `NoteWindow.jsx` now wraps a
   `.fb-penswatch` inner span carrying the original dot and its `is-on` ring,
   and the button is the invisible 44px hit box around it — the visible
   design is unchanged. `.fb-notetools` gained `flex-wrap: wrap` since five
   44px pen buttons plus three 44px width buttons plus the Undo/Clear ghosts
   no longer fit `NOTE_W`'s one row; it wraps to a second line rather than
   overflowing or widening the note past its established proportions. Every
   `<Avatar>` call site was also audited directly, per the audit doc's own
   delegation note — none of them is a bare tap target (each is either
   decorative or paired with a text label inside a larger button), so none
   were touched; `.fb-leg`/`.fb-avpill`'s own sizing is flagged in
   `tap-target-audit.md` for whoever next revisits it, not fixed here.
2. **Swipe paging.** `src/hooks/useSwipePage.js`, pointer-event based,
   gated to day/week in `App.jsx`. The stepping logic (a month at a time in
   month view, seven days in week, one day otherwise) was pulled out of
   `Footer.jsx` into `stepAnchor()` in `lib/date.js` so the chevrons and the
   swipe gesture can't drift apart — Footer's own `page()` now just calls it.
3. **Orientation.** Asked before touching anything, per this item's own
   instruction. Landscape 1080×810 stays; SCOPING.txt's "810×1080pt" reading
   is not being pursued. No code changed for this item.
4. **Error boundary + loading/offline/failure UI.**
   `src/components/shell/ErrorBoundary.jsx` wraps `<App>` in `main.jsx` —
   a render throw now lands on a plain-inline-styled recovery screen (styled
   outside tokens.css deliberately, since the point is surviving a failure
   that could be upstream of BoardStyles itself) with a manual "Reload now"
   button and a 30-second auto-reload, since this board runs unattended with
   nobody to tap it. `useBoardData.js` gained a `degraded` flag and a
   try/catch around `source.list()` — Deferred Defect #7, fixed: a rejection
   used to escape as an unhandled promise; now it's caught, logged, and the
   cached events from `migrate()` stay on screen instead. `App.jsx` shows a
   loading message in the stage instead of each view's own empty state
   (Deferred Defect #14) only when there's truly nothing to paint yet
   (`!loaded && events.length === 0`) — a warm reload with cached events
   skips it entirely, unchanged from R3's cache-paints-first behaviour.
   `Header.jsx` shows a quiet "Offline" `.fb-chip` when `degraded` or a
   storage write failed, reusing the same pill "Back to today" already uses
   rather than inventing a second visual language for status.
5. **Deferred Defects assigned here, all fixed:**
   - **#1** (`NoteWindow.jsx`'s `onUp` calling `onSave` inside a `setStrokes`
     updater) — the updater call was always redundant besides being a
     StrictMode double-fire risk: `onMove` already lands every point of the
     in-progress stroke in `strokes` state, so by pointer-up `strokes` *is*
     the finished stroke. `onUp` now just reads the closed-over `strokes` and
     calls `onSave` directly.
   - **#2** (`AgendaView` rendering avatars for filtered-out people) —
     `App.jsx` now passes `shownMembers`, matching `DayView`, instead of the
     unfiltered `roster`.
   - **#3** (`useIdle` re-registering three window listeners on every
     settings edit) — `seconds`/`enabled` moved into refs `reset` reads from,
     so `reset` itself is stable and the listener effect's `[reset]`
     dependency no longer changes; a second effect still calls `reset()` on
     every `seconds`/`enabled` change so the timer itself still restarts.
   - **#4** (Composer's hour picker hardcoded 6am–10pm) — `Composer.jsx` now
     walks `[settings.dayStart, settings.dayEnd)`, the same half-open range
     `DayView`/`WeekView` already loop over for their own gutters, via a new
     `settings` prop `App.jsx` passes at the call site.
   - **#5** (`NoteWindow` handed a dead `members` prop) — deleted at the
     `App.jsx` call site; the component never destructured it in the first
     place.
   - **#16** (Sleep section had no Black/Dim control and only displayed
     `wakeTapSeconds`) — `Settings.jsx` gained a Black/Dim pill pair bound to
     `settings.sleepStyle`, gating the existing 0-0.4 dim slider (it only
     means anything in "dim"), and an editable `wakeTapSeconds` number field
     next to the note that used to only display it, clamped the same 5-3600
     range `migrate()` already enforces. `App.jsx` passes `0` for
     `<SleepVeil>`'s opacity when the style is "black" — `SleepVeil` still
     floors that at 0.02 so a sleeping board never reads as a dead one, per
     its own existing comment; that floor was left alone rather than
     special-cased away for "black", since the reasoning behind it applies
     regardless of which style chose the veil's opacity.
   - **#12**, tidied rather than fixed (R3's note already made the crash it
     names unreachable): `Settings.jsx`'s Board color read is now
     `THEMES[settings.theme] || THEMES.paper`, matching the pattern every
     other consumer already uses, as defense in depth.
6. **Focus trap + Escape on `Sheet`.** `Sheet.jsx` — Escape closes from
   anywhere inside (a `keydown` listener on the sheet's own div, not
   `document`, since every key bubbles to it naturally); Tab/Shift+Tab wrap
   at the sheet's first/last focusable descendant instead of escaping to
   whatever's behind the scrim; focus moves onto the sheet's first focusable
   element (the header's own Close button) on open unless something inside —
   Composer's and EventDetailSheet's own `autoFocus` title inputs — has
   already claimed it, and returns to whatever had focus before once the
   sheet unmounts. Composer, Settings and EventDetailSheet all get this for
   free; none of the three needed a change.
7. **Long-run soak.** No multi-day live soak is possible from this session —
   flagging that limitation rather than claiming one happened. What *is*
   done: every `setInterval`/`setTimeout`/`addEventListener` in `src/` was
   read end to end (`useNow`, `useSleep`, `useIdle`, `Fit`, `Screensaver`,
   `useWeather`, `useDrivePhotos`, `google.js`'s poll+wake listeners) and each
   pairs cleanup correctly except `useIdle`, fixed under item 5 above — no
   other timer or listener leak found. One correctness bug well beyond a
   "leak" was found and fixed while doing this audit; see the next paragraph.
   R14's runbook is the right home for an actual multi-day device soak
   procedure, which this role did not write — out of scope for a role whose
   own acceptance bar is code, not a runbook.

**R12 note on a disclosed touch outside its owned paths — `src/data/google.js`
(R8's file).** While auditing for item 7, found and verified (with a throwaway
reproduction before writing the real fix) that `refreshAll()` did `cache = merged`
on *every* branch, including the sync-token poll — which the app only ever takes,
since `useBoardData.js` calls `source.list()` with no range. Google's sync-token
response is a diff (created/updated/cancelled since the last poll), not a fresh
snapshot, so every unchanged event — the overwhelming majority, on any given poll —
was silently dropped from `cache` every `POLL_MS` (5 minutes). A healthy poll was
erasing the board, not just a failed one. Checked with the user before fixing a
file outside R12's owned paths, given PLAN.md §5 rule 3; asked to fix it disclosed
rather than only log it, given the severity and that it undermines both R8's own
acceptance bar and this role's "no drift over days of uptime" one. The fix: for the
sync-token branch only, each calendar's changed events are upserted into `cache`
and its cancelled ids removed, leaving everything else alone; a calendar whose own
fetch came back as a full set rather than a delta (no token yet, or one just
invalidated by a 410) reconciles `cache` against that complete set for that one
calendar only, so a deletion that happened while its token was stale doesn't linger
forever. The other branch (`useSyncToken: false`, only ever reached by
`list(range)`, which nothing in the app actually calls) is untouched — that result
already is the complete answer for its bounded range, so wholesale replacement was
and remains correct there. Four new tests in `google.test.js` cover it: an
unchanged event survives an empty delta, an update in a later delta still applies,
a cancellation removes the event, and one calendar's empty delta doesn't erase
another calendar's events.

---

**R14 note.** Wave 4, last role — R1 through R13 are all merged into `main`. This
role's mandate ("get it onto the wall and keep it there") is entirely documentation
and deployment configuration, not application code, so nothing under `src/` or
`api/` changed. Landed: `docs/README.md` (reading order + the acceptance bar this
folder is held to) and five runbook documents, cross-referencing each other and the
actual shipped code rather than restating PLAN.md's plan-stage description of it:

1. **`docs/DEPLOY.md`** — backlog item 1. Confirms R1's `vercel.json` choice
   (`BUILD-NOTES.md` item 1) rather than re-deciding a hosting provider, and walks
   the OAuth consent run end to end against R4's actual endpoints
   (`api/auth/google.js`'s "run once" comment, `api/health.js`, `api/auth/
   refresh.js`) — every `curl` in it targets a real, landed route, not a
   hypothetical one. Includes secret rotation for all three secrets R4 defined.
2. **`docs/DEVICE-SETUP.md`** — backlog item 2. Home-screen install, Auto-Lock,
   Guided Access, and — the one thing not explicit in the backlog line but
   necessary to make the other three coherent — what a redeploy actually requires
   on a standalone PWA with no reload button (`vercel.json`'s cache headers plus a
   close-and-reopen cycle, since `overscroll-behavior: none` in `index.html` is
   deliberate and rules out pull-to-refresh).
3. **`docs/BRIGHTNESS-SHORTCUTS.md`** — backlog item 3. Two Shortcuts automations
   (sunset/sunrise), not three, with the reasoning for why two covers the spec's
   three named brightness states written down rather than left implicit. Explicit
   about this being independent from `settings.bedtime`/`wakeTime`/`sleepStyle`
   (R3/R12's in-app veil) — same spirit as PLAN.md §R14's own item 3 note, restated
   for an operator who won't have read PLAN.md.
4. **`docs/RECOVERY.md`** — backlog item 4. Keyed to the actual failure surfaces
   that exist in the landed code: `ErrorBoundary`'s 30s auto-reload, `Header`'s
   `degraded` "Offline" chip and what `useBoardData` means by it, `store.js`'s
   `StorageError` codes and its deliberate no-self-heal design (its own comment
   anticipates this doc: *"a human clears it with `store.remove()`"*), and
   `api/auth/refresh.js`'s non-secret-leaking failure report for diagnosing a
   revoked Google grant. Also carries Deferred Defect #10's disposition (see below).
5. **`docs/BACKUP-RESTORE.md`** — backlog item 5. `store.js`'s per-write `{v, at,
   data}` envelope and its own comment (*"R14's recovery notes need an answer that
   does not depend on the app still working"* / *"R14's backup and restore notes
   lean on [`store.remove()`]"*) were written by R3 anticipating exactly this doc.
   No in-app export/import exists — building one would mean editing `Settings.jsx`,
   outside this role's owned paths — so the procedure is a Web Inspector console
   script against the real `board:`-namespaced keys, using Safari's `copy()` to get
   a backup off the device without any extra tooling.
6. **`docs/SOAK-TEST.md`** — not its own backlog line, but R12's own handoff note
   asked for it by name: *"R14's runbook is the right home for an actual multi-day
   device soak procedure ... out of scope for a role whose own acceptance bar is
   code, not a runbook."* Written around the concrete intervals that actually exist
   in the shipped code (`useNow`'s clock tick, `Screensaver`'s 30s rotation, and
   especially `google.js`'s 5-minute poll — R12's note documents a real bug this
   exact loop had, caught only by a running board, not a unit test) rather than a
   generic "watch memory for a while" checklist.

**Disposition of Deferred Defect #10** (Google Fonts `@import` is a runtime network
dependency, assigned to this role in the table above). Not fixed: the fix is
self-hosting the font, which means editing `src/styles/shell/Fit.js` — R5's owned
path, not `docs/` or deployment configuration, and R5's own work there is already
merged and not otherwise being revisited. Per §5 rule 3, recorded rather than
reached into silently: `docs/RECOVERY.md` documents it as a cosmetic-only,
self-resolving-once-network-returns limitation so an operator hitting it doesn't
mistake it for a real outage. `index.html`'s existing `<link rel="preconnect">`
(R1) is the only mitigation in place; a full fix is left for whoever next owns
`src/styles/shell/Fit.js`.

**Acceptance re-checked against PLAN.md's own wording:** every step in
`DEPLOY.md` → `DEVICE-SETUP.md`, followed in order against a real Vercel project
and a real iPad, reaches a running, pinned board — no step assumes information not
already in an earlier doc or in a file the docs explicitly point to
(`.env.example`, `CONTRACTS.md`, the specific `src`/`api` files cited above).
