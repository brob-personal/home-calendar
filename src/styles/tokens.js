/*
  Design tokens — the 60/30/10 contract (60% paper, 30% surface, 10%
  per-person pastel) as named custom properties, plus every other literal
  the per-component sheets below used to hardcode.

  Stays a JS template rather than a real tokens.css: vitest.config.js sets
  `css: false` (R1-owned), which stubs *any* .css import — including one
  loaded with Vite's `?raw` suffix — to an empty string under test. R2's
  original chunks hit this same wall and chose JS templates for it; R5
  verified the wall is still there before repeating that choice rather than
  assuming.

  --paper / --surface / --line / --ink / --mute are per-theme. App.jsx sets
  them as an inline style on .fb-root from the active src/lib/theme.js
  THEMES entry — that inline declaration always wins over the defaults
  below, so this block only supplies a safe "paper" fallback for the
  instant before that effect runs, never overrides it.

  --now is not per-theme: PLAN.md reserves it for the current-time line
  "and nothing else" (ACCENT_NOW). One legal value across every theme, so
  it lives here rather than among the per-theme set App.jsx assigns.

  --ink-on-color is the fixed dark text colour event blocks use against
  their own pastel fill (day/week/month/avatar/sheet-preview). It must not
  follow --ink through a theme swap — the pastel fills it sits on aren't
  part of the theme.

  --note-* is the sticky note's own fixed yellow-paper palette. A note is a
  physical-object metaphor, not a themed surface, so it does not read
  --paper/--surface either.

  --danger-bg / --danger-ink are EventDetailSheet's delete-confirm colours
  (R7, PLAN.md §R7 item 5). They happen to share a hex with --now today, but
  stay their own tokens rather than aliasing it: --now is reserved for the
  now-line "and nothing else," and a future now-line recolour shouldn't drag
  the delete button's danger red along with it.

  --footer-h / --board-gap / --board-pad-b feed --dock-bottom, the derived
  value PLAN.md §R5 item 3 calls out: `.fb-dock`'s bottom offset has to clear
  the footer plus the board's own padding and flex gap, and nothing enforced
  that before. (Its sibling duplication, `.fb-axis`'s left margin against
  Day's old lane-name column, was retired by R7's DayView rewrite along with
  the column it measured — there is no --lane-name-w/--lane-gap here because
  nothing consumes them anymore.)
*/
export default `
:root {
  --paper: #FCFCFD;
  --surface: #F0F1F4;
  --line: #E2E4E9;
  --ink: #23262D;
  --mute: #787E8A;

  --now: #E0574F;
  --ink-on-color: #24262B;

  --tap-min: 44px;

  --note-paper: #FFF8D6;
  --note-header: #F5EDC4;
  --note-ink: #2A2620;
  --note-mute: #6B6250;
  --note-width-on-bg: rgba(0,0,0,.07);
  --shadow-peek: rgba(30,34,42,.16);
  --shadow-fab: rgba(30,34,42,.24);
  --shadow-note: rgba(30,34,42,.3);

  --scrim: rgba(28,32,40,.32);
  --shadow-sheet: rgba(24,28,36,.24);
  --shadow-row: rgba(30,34,42,.1);
  --shadow-device: rgba(20,24,32,.18);
  --frame-bg: #D9DBE0;

  --saver-scrim-top: rgba(0,0,0,.66);
  --saver-scrim-bottom: rgba(0,0,0,.1);
  --saver-ink: #2A2D33;

  --veil-bg: #000;
  --ink-on-dark: #fff;

  --danger-bg: #E0574F;
  --danger-ink: #C43A33;

  --footer-h: 60px;
  --board-gap: 14px;
  --board-pad-b: 18px;
  --dock-bottom: calc(var(--footer-h) + var(--board-gap) + var(--board-pad-b));
}
`;
