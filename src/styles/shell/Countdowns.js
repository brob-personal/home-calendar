/*
  Countdowns — 46px — and the stage that takes the rest of the column.

  .fb-stage sits here rather than in Root.js because it is the sibling that
  absorbs whatever height the countdown row does or does not occupy: the
  row is only rendered when there is a milestone to show, so the stage
  grows by 46px plus one board gap when nothing is counting down.

  .fb-stage's margin-bottom is --stage-gap-b, not zero: now that Footer no
  longer sits below it as a flex sibling, the calendar would otherwise run
  flush to the bottom edge. The reserved strip this margin creates is where
  NoteDock's floating FAB (../notes/NoteDock.jsx) lives — see --dock-bottom
  in tokens.js.

  .fb-stage carries its own --surface card now — the same grey as the
  button chrome elsewhere — so the active view (Day/Week/Month/Agenda)
  reads as a contained panel instead of raw content bleeding to the
  board edges. border-radius + overflow: hidden (Sheet.js's card pattern)
  means whatever a view scrolls internally (`.fb-daybody`/`.fb-weekbody`/
  `.fb-agenda`, each still owning its own overflow-y: auto) is clipped by
  the rounded corners rather than cutting off square. The padding here is
  the reason MonthView's `.fb-cell` and WeekView's `.fb-wcol.is-today` were
  switched from --surface to --paper: on a --paper board they needed the
  grey to stand out, but sitting inside this grey card that same grey
  would now match the card and erase their edges.
*/
export default `
/* Countdowns — 46px */
.fb-countdowns { display: flex; gap: 30px; align-items: baseline; height: 46px; flex: none; }
.fb-cd { display: flex; align-items: baseline; gap: 6px; }
.fb-cdnum { font-size: 28px; font-weight: 800; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.fb-cdunit { font-size: 13px; color: var(--mute); }
.fb-cdlabel { font-size: 15px; font-weight: 500; }

.fb-stage {
  flex: 1; min-height: 0; margin-bottom: var(--stage-gap-b);
  background: var(--surface); border-radius: 18px; overflow: hidden;
  padding: 16px 18px;
}
`;
