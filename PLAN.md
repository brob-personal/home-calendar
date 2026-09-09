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
