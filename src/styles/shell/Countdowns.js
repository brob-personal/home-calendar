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

  .fb-stage paints nothing of its own. It used to be a card: --paper fill,
  an 18px radius, and a ::before washing --stage-art at .22 against
  .fb-art's .85 on the board, so it "read as a distinct lighter surface."
  On the wall that distinct lighter surface read as a grey border framing
  the calendar — a hard-edged, near-untinted rectangle sitting inside a
  strongly tinted board, on all four sides at once. Measured off a 1080x810
  render: board #F5DBC6, card #FAF9F7. That gap is the artefact, and the
  two opacities were tuned to create it deliberately.

  So the card is gone and the board's single .fb-art wash now runs
  unbroken behind the calendar. Nothing marks where the stage begins,
  which is the point — there is no frame left to see.

  What stays and why:

  - padding: 16px 18px. src/lib/layout.js derives TRACK_W from these two
    numbers (with .fb-board's 24px and the 56px gutter), so they are a
    layout contract, not decoration. With the fill gone the padding shows
    the same tinted board as everything around it, so it costs nothing
    visually — it is just breathing room before the board edge.

  - overflow: hidden. Each view still scrolls internally
    (`.fb-daybody`/`.fb-weekbody`/`.fb-agenda` own their overflow-y), and
    this is what keeps that content inside the stage box. It clips square
    now rather than to a radius; with a continuous background behind it
    there is no corner to notice.

  MonthView's `.fb-cell`, WeekView's `.fb-wcol.is-today`, DayView's
  `.fb-alldaychip` and MonthView's `.fb-monthweather` are untouched. They
  are flat --paper, and they now sit directly on the fully-washed board
  instead of on a faintly-washed card, so they read with more contrast
  than before, not less.
*/
export default `
/* Countdowns — 46px */
.fb-countdowns { display: flex; gap: 30px; align-items: baseline; height: 46px; flex: none; }
.fb-cd { display: flex; align-items: baseline; gap: 6px; }
.fb-cdnum { font-size: 28px; font-weight: 800; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.fb-cdunit { font-size: 13px; color: var(--mute); }
.fb-cdlabel { font-size: 15px; font-weight: 500; }

.fb-stage {
  position: relative;
  flex: 1; min-height: 0; margin-bottom: var(--stage-gap-b);
  overflow: hidden;
  padding: 16px 18px;
}
`;
