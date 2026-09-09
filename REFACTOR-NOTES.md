# R2 — Refactor Surgeon: handoff notes

Wave 0, role R2. Mandate was mechanical decomposition of `family-board.jsx` into the
tree in PLAN.md §2, with **zero behaviour change**. No features, no bug fixes.

One file of 2,106 lines became 57 modules under `src/` (excluding tests and
`src/test/`), of which 15 are the split stylesheet. `family-board.jsx` is deleted
(backlog item 6).

## How to verify "zero behaviour change" yourself

Two independent checks, because "it looks the same to me" is not a review.

**1. The stylesheet is byte-identical.** `src/styles/styles.contract.test.js` asserts
the fifteen-chunk join in `src/styles/index.js` equals
`src/test/fixtures/prototype-css.txt`, which was extracted from the prototype's CSS
template literal with `${CANVAS_W}`/`${CANVAS_H}` resolved and CRLF normalized to LF.
Regenerate the fixture against any commit that still has the prototype:

```sh
git show 60bde8f:family-board.jsx > family-board.jsx
node scripts/extract-prototype-css.mjs     # prints IDENTICAL: true
```

**2. The DOM is identical.** R2 ran a throwaway equivalence harness that mounted the
restored prototype and the decomposed `App` side by side under one frozen clock
(`vi.setSystemTime`) and diffed `container.innerHTML` with the `<style>` element
removed — its equality is already covered by check 1. Seven cases passed: all four
views, the settings panel, the composer, and a filter toggle. Same markup, same
classNames, same inline styles.

The harness is not committed, because it depends on a file that no longer exists.
Recreate it in ten minutes if you need it: restore the prototype as above, render
both, freeze the clock, compare markup. It is the check worth running if anyone ever
suspects R2 of changing something.

`npm run test` (9 passing), `npm run lint` (clean), `npm run build` (84 modules) all
pass. R1's four smoke tests pass unmodified — only the import path and the local name
changed in `src/board.smoke.test.jsx`.

## What moved where

| Prototype | Now |
| --- | --- |
| `:17-18` canvas constants | `src/lib/canvas.js` |
| `:20-39` `store` | `src/lib/store.js` |
| `:41-70` `THEMES` `ACCENT_NOW` `MONTH_ART` | `src/lib/theme.js` |
| `:72-93` `DEFAULT_MEMBERS` `DEFAULT_SETTINGS` | `src/contracts/defaults.js` |
| `:96-97` `uid` | `src/lib/uid.js` |
| `:99-176` colour helpers, `VARIATIONS`, `variantColor`, `splitFill` | `src/lib/color.js` |
| `:112-114` `initialOf` | `src/lib/text.js` |
| `:178-220` date helpers + `DOW` / `DOW_LONG` / `MONTH_SHORT` | `src/lib/date.js` |
| `:225-359` `seedEvents` + `createMockSource` | `src/data/mock.js` |
| `:301-350` the `>>> SWAP` Google adapter design note | `src/data/index.js` |
| `:355-362` `useNow` | `src/hooks/useNow.js` |
| `:362-373` `parseHM` `isAsleep` | `src/lib/sleep.js` |
| `:375-394` `useIdle` | `src/hooks/useIdle.js` |
| `:396-419` `Fit` | `src/components/shell/Fit.jsx` |
| `:423-680` the root component | `src/App.jsx` + four hooks + `PaletteContext` |
| `:682-705` `Avatar` | `src/components/shell/Avatar.jsx` |
| `:710-761` `Header` `Countdowns` | `src/components/shell/` |
| `:765-1030` the four views | `src/components/views/` |
| `:1035-1082` `Footer` | `src/components/shell/Footer.jsx` |
| `:1084-1297` notes | `src/components/notes/` |
| `:1300-1436` `Composer` | `src/components/settings/Composer.jsx` |
| `:1441-1625` `Settings` | `src/components/settings/Settings.jsx` |
| `:1630-1673` `SleepVeil` `Screensaver` | `src/components/idle/` |
| `:1678-1726` `Sheet` `Field` icons | `src/components/shell/` |
| `:1729-2106` the 378-line CSS string | `src/styles/` — fifteen chunks |

Every module carries a header comment naming the prototype lines it came from, so
`git log`-archaeology against `60bde8f` stays possible after the file is gone.

## The 255-line root, decomposed

`App.jsx` keeps exactly four pieces of state — `view`, `anchor`, `panel`, `noteOpen`
— which are the four that are genuinely about the shell. The rest went to:

- **`useBoardData(now)`** — the source, the four persisted slices, the load-once
  effect, the three write-through effects, event create/delete, note saving.
- **`useMemberFilter(members, events)`** — the null-means-default `hidden` dance,
  `isShown`, `shownMembers`, `filtered`, `filterTouched`.
- **`useSleep(now, settings, blocked)`** — `isAsleep`, the wake grace window,
  `useIdle`, `showSaver`. `blocked` collapses the root's `!panel && !noteOpen`.
- **`useBoardPalette(members, settings, isShown)`** — `palette`, `byId`, `fillFor`,
  `firstColor`.

**Hook call order in `App.jsx` is load-bearing.** It is arranged so effects still
register in the prototype's order: `useNow`'s interval, then the load effect, then
persist-members, persist-settings, persist-notes, then `useIdle`'s listeners, then
the wake timer. `store.set` ordering is observable; do not reorder these calls
casually.

## Deviations from the letter of the plan

Four, all small, none behavioural.

1. **`PaletteContext.js`, not `.jsx`, and no `PaletteProvider` wrapper.** §2 puts
   `PaletteContext` in `src/state/`, which it does. It exports the context object and
   two hooks and no components, so `App.jsx` renders `<PaletteContext.Provider>`
   directly. A file exporting both a component and hooks trips
   `react-refresh/only-export-components`; this way `npm run lint` is clean with no
   suppressions and there is one less indirection.

2. **CSS is fifteen JS modules exporting strings, not fifteen `.css` files.** Three
   reasons, documented at length in `src/styles/index.js`: cascade order stays
   explicit rather than becoming a property of the module graph; `vitest.config.js`
   sets `css: false`, so real CSS imports are stubbed and R1's smoke test could not
   assert the canvas contract; and `fit.js` interpolates `CANVAS_W`/`CANVAS_H` from
   `src/lib/canvas.js` rather than restating 1080 and 810. **R5 should convert these
   to `tokens.css` plus modules** — that is R5's mandate, and this shape is a
   faithful intermediate, not a recommendation.

3. **`initialOf` went to `src/lib/text.js`.** §R2 item 1 names `color.js`'s exports
   explicitly and `initialOf` is not among them. It is a name helper, not a colour
   one.

4. **`Composer.jsx` sits in `src/components/settings/`.** §2 labels that directory
   "panels", and the composer and the settings sheet are the two things `panel`
   switches between. Not a `Settings` concern semantically; it is a panel.

## For R3

You own `src/contracts/`, `src/lib/store.js`, `src/data/index.js`,
`src/data/mock.js`, `src/state/`. All five exist and all five carry a comment
pointing at your relevant backlog item.

- `src/lib/store.js` still calls `window.storage`, which exists in no browser. Both
  bodies swallow the failure, so the board runs and forgets everything on reload.
  Your item 3.
- `src/data/index.js` exposes `createSource()`. `list` / `create` / `remove` exist;
  `update` and `subscribe` do not. Your item 5.
- `src/contracts/defaults.js` is `DEFAULT_SETTINGS` verbatim. Your item 4 adds
  `mode`, `calendars`, `weather`, `drive`, `sleepStyle`, and surfaces
  `wakeTapSeconds`, which is currently hardcoded and only ever displayed.
- **Defects #12, #13 and #14 in PLAN.md §7 are yours or adjacent to yours.** #12 is a
  latent crash in the Settings panel your `migrate()` is the natural place to prevent.
- `src/state/` holds `PaletteContext.js`. It takes its value as a prop, so wrapping
  it in `BoardContext` needs no change to the colour logic.

## For R5

You own `src/styles/**` exclusively. Fifteen chunks, ordered, joined by `index.js`.

- **`fit` must lead** — its Google Fonts `@import` must precede every rule in the
  sheet or the browser drops it. **`motion` must trail** — `prefers-reduced-motion`
  overrides durations declared above it.
- `styles.contract.test.js` will go red the moment you change a byte. That is
  intentional: it is R2's proof of a behaviour-neutral split, not a permanent
  constraint. **Delete it in the same commit that lands `tokens.css`**, deliberately.
  Do not delete it to turn a red suite green.
- **Your item 3, the magic numbers, are commented in place.** `.fb-axis
  { margin-left: 164px }` in `day.js` is `.fb-lanename`'s 150px plus `.fb-lane`'s 14px
  gap. `.fb-dock { bottom: 92px }` in `notes.js` is the 60px footer plus the board's
  18px bottom padding.
- **Your item 4, the sub-44pt audit, is already enumerated.** Every one of the six
  selectors carries a comment saying so: `.fb-icon` 42px (`header.js`), `.fb-pen`
  22px, `.fb-width` 26px, `.fb-notenav`/`.fb-noteclose` 30px (`notes.js`),
  `.fb-shade` 40x28 (`sheet.js`). `.fb-fab` at 56px is the only one that passes.
- **Defect #11 is yours** and it is in `fit.js`: `.fb-fit { height: 100vh }` needs
  `100dvh` with a `100vh` fallback.
- Colour literals are in `src/lib/theme.js` (`THEMES`, `ACCENT_NOW`, `MONTH_ART`),
  read from JS, plus `PENS` in `src/components/notes/geometry.js`. Those are the
  literals your "zero hardcoded colour literals" criterion is about. Note `PENS[1]`
  is `#E0574F`, the same value as `ACCENT_NOW` — a coincidence, not a shared token.
  `ACCENT_NOW` is the now-line's exclusive colour.

## For R7

`src/components/views/DayView.jsx` is yours, and its header comment is written for
you: what to preserve, why the view colours blocks per-lane instead of via
`fillFor`, and why it therefore does not consume `PaletteContext`.

The hour gutter you are asked to share (your item 2) is `.fb-gutter fb-hours` in
`WeekView.jsx` with `HOUR_H = 34`. Extracting a `TimeGutter` means editing
`WeekView.jsx`, which is outside your paths — route it through R0 first.

Defect #6, the `onDoubleClick` delete, is still there and still the app's only delete
path. There is no edit path anywhere in the app; your detail sheet will need R3's
`update`.

## For R12

Defects #1, #2, #3, #4, #5, #7 all survived intact and each is commented at its new
location with its number. The two that are easiest to lose track of are the two that
live at *call sites* rather than in a component, and both are commented inline in
`App.jsx`: `AgendaView` gets `members` where `DayView` gets `shownMembers` (#2), and
`NoteWindow` is handed a `members` prop it has never destructured (#5). Both are
one-line fixes there.

New from R2: **#14**, that nothing distinguishes "loading" from "loaded and empty" —
relevant to your item 4.

## For R13

- `src/lib/` and `src/contracts/` are the coverage targets named in the plan and they
  are now real modules with no React in them. `color.js`, `date.js`, `sleep.js`,
  `text.js` and `uid.js` are pure and total. `isAsleep` and its midnight wrap are in
  `src/lib/sleep.js`.
- **Defect #9 is documented rather than fixed.** `MonthView`'s `cut` logic now has a
  full explanation in place — the six-week grid, why whole weeks are dropped rather
  than trailing cells, and why `visible.length / 7` is an exact row count. Test
  against that description; if the code disagrees with it, the code is the bug.
- `src/styles/styles.contract.test.js` is R2's, and it belongs to R5's lifecycle, not
  yours — see the note above about deleting it deliberately.
- The fixed-viewport 1080x810 pass in your backlog still needs a real browser. The
  `ResizeObserver` stub in `src/test/setup.js` never fires, because jsdom reports 0x0
  and a real measurement would compute `scale: 0`.

## Housekeeping

- `eslint.config.js` — R1's `family-board.jsx` override block is gone with the file.
  Nothing under `src/` needs it: the unused `React` import went with the prototype,
  and the four unescaped apostrophes are `&apos;` in `Settings.jsx` (which decodes to
  the same U+0027 the prototype rendered). Added `scripts/**` to the Node-globals
  block for `extract-prototype-css.mjs`.
- `.prettierignore` — the `family-board.jsx` entry is gone; `src/test/fixtures/` is
  added, because reformatting a byte-for-byte fixture would break the comparison it
  exists to make.
- Eight files were already failing `prettier --check` before R2 touched anything
  (`.prettierrc`, `BUILD-NOTES.md`, `index.html`, `package.json`, `vercel.json`,
  `vite.config.js`, `vitest.config.js`, `src/test/setup.js`). R2 formatted only what
  it authored and left those alone — `format:check` is in no role's acceptance
  criteria, so this is R0's call, not a silent fix.
