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

  .fb-stage carries its own card now — the active view (Day/Week/Month/
  Agenda) reads as a contained panel instead of raw content bleeding to
  the board edges. border-radius + overflow: hidden (Sheet.js's card
  pattern) means whatever a view scrolls internally (`.fb-daybody`/
  `.fb-weekbody`/`.fb-agenda`, each still owning its own overflow-y:
  auto) is clipped by the rounded corners rather than cutting off
  square.

  The card's own background is --paper (the active theme's off-white —
  paper/cream/mist/sage/blush, whichever THEMES entry is selected), not
  --surface: a flat grey card read as its own disconnected box, where a
  paper-toned one reads as the same "paper" the rest of the board sits
  on, just lifted into a card. --stage-art (set inline by App.jsx from
  MONTH_ART[now.getMonth()], the same seasonal gradient `.fb-art`
  washes the whole board with, or "none" when Settings' "Tint the board
  with this month's artwork" checkbox is off) layers on top via ::before
  at reduced opacity so the card picks up a soft seasonal tint rather
  than sitting flat. z-index: 0 on .fb-stage pins that ::before's
  z-index: -1 to this box specifically (CSS's
  negative-z-index-escapes-an-unrooted-ancestor trap) so the tint stays
  behind this card's own content, not some further-out ancestor's.

  MonthView's `.fb-cell`, WeekView's `.fb-wcol.is-today`, DayView's
  `.fb-alldaychip`, and MonthView's `.fb-monthweather` all stay on flat
  --paper (not the tinted card background) so they still read as
  distinct panels sitting on top of the tinted card instead of
  blending into it.
*/
export default `
/* Countdowns — 46px */
.fb-countdowns { display: flex; gap: 30px; align-items: baseline; height: 46px; flex: none; }
.fb-cd { display: flex; align-items: baseline; gap: 6px; }
.fb-cdnum { font-size: 28px; font-weight: 800; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.fb-cdunit { font-size: 13px; color: var(--mute); }
.fb-cdlabel { font-size: 15px; font-weight: 500; }

.fb-stage {
  position: relative; z-index: 0;
  flex: 1; min-height: 0; margin-bottom: var(--stage-gap-b);
  background: var(--paper); border-radius: 18px; overflow: hidden;
  padding: 16px 18px;
}
.fb-stage::before {
  content: ""; position: absolute; inset: 0; z-index: -1;
  background-image: var(--stage-art); opacity: .6; pointer-events: none;
}
`;
