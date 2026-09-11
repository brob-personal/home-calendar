/*
  Header — 92px.

  .fb-icon was 42px, one of the six selectors on R12's 44pt list (backlog
  item 1) — raised to --tap-min. See tap-target-audit.md for the full list.

  .fb-chip / .fb-icon live here rather than in HeaderControls.js because
  they predate the redesign that introduced that file and Sheet footers
  already share .fb-chip/.fb-primary across files the same way.

  .fb-headmeta anchors from the top (align-self: flex-start + margin-top),
  not the bottom .fb-head otherwise uses: it used to be flex-end with a
  padding-bottom nudge, but that coupled the month/count line's position to
  .fb-headinfo's height below it — the weather chip is taller than the bare
  clock it replaced, so that bottom-anchor pushed the month/count line up
  above .fb-num instead of level with it. Anchoring from the top keeps
  .fb-month level with .fb-num regardless of what .fb-headinfo contains.
*/
export default `
/* Header — 92px */
.fb-head { display: flex; align-items: flex-end; gap: 20px; height: 92px; flex: none; }
.fb-datestack { display: flex; align-items: baseline; gap: 13px; }
.fb-dow { font-size: 27px; font-weight: 500; letter-spacing: -.015em; color: var(--mute); }
.fb-num { font-size: 82px; font-weight: 800; line-height: .82; letter-spacing: -.045em; font-variant-numeric: tabular-nums; }

/*
  .fb-roller backs items 1-3's day-of-week/date-number "odometer" (see
  Roller.jsx) — and now the month and year beside them, which roll the same
  way and in the same direction — and, just as importantly, item 3's
  fixed-width header: every possible value is stacked in the same grid cell
  via .fb-roller-size (kept in-flow with visibility:hidden rather than
  removed, so it still counts toward the grid track's intrinsic width),
  which means .fb-roller's own width is always the widest any value could be
  and never changes as you page — the reason .fb-headright stops shifting
  horizontally.

  Only one level of grid nesting, with a plain text span as the first grid
  item (one of the .fb-roller-size copies): a grid container's synthesized
  first baseline comes from its first in-flow item's own baseline, so this
  matches the plain <span> baseline .fb-datestack's align-items:baseline
  relied on before this was a grid.
*/
.fb-roller { display: inline-grid; overflow: hidden; }
.fb-roller > * { grid-area: 1 / 1; }
.fb-roller-size { visibility: hidden; white-space: nowrap; }
.fb-roller-viewport { position: relative; }
.fb-roller-val { position: absolute; inset: 0; white-space: nowrap; }
.fb-roller-in-up { animation: fb-roll-in-up .22s ease; }
.fb-roller-in-down { animation: fb-roll-in-down .22s ease; }
.fb-roller-out-up { animation: fb-roll-out-up .22s ease forwards; }
.fb-roller-out-down { animation: fb-roll-out-down .22s ease forwards; }
@keyframes fb-roll-in-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes fb-roll-out-up { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
@keyframes fb-roll-in-down { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes fb-roll-out-down { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }

.fb-headmeta { align-self: flex-start; margin-top: 25px; }
.fb-month { font-size: 19px; font-weight: 600; letter-spacing: -.012em; }
/*
  Month and year are <Roller>s too, so .fb-roller already gives them the
  stacked sizers that used to be .fb-monthname's own hand-rolled copy of that
  trick. The year has no enumerable value set to stack, so tabular-nums is
  what makes its single "0000" sizer honest: every four-digit year is then
  exactly as wide as that sample.
*/
.fb-year { font-variant-numeric: tabular-nums; }
.fb-sub { font-size: 14px; color: var(--mute); margin-top: 2px; }
.fb-headinfo { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.fb-clock { font-size: 20px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--mute); }
.fb-chip {
  font-size: 13px; font-weight: 600; padding: 8px 14px;
  background: var(--surface); border-radius: 999px; color: var(--mute);
}
.fb-icon {
  display: grid; place-items: center; width: var(--tap-min); height: var(--tap-min);
  border-radius: 11px; color: var(--mute); background: var(--surface);
}
`;
