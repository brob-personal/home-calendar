/*
  Countdowns — 46px — and the stage that takes the rest of the column.

  .fb-stage sits here rather than in Root.js because it is the sibling that
  absorbs whatever height the countdown row does or does not occupy: the
  row is only rendered when there is a milestone to show, so the stage
  grows by 46px plus one board gap when nothing is counting down.

  .fb-stage has no margin-bottom any more. It carried --stage-gap-b, 56px of
  reserved strip left over from the retired footer row, on the argument that
  the calendar would otherwise run flush to the bottom edge — but the board's
  own --board-pad-b already holds it off that edge, and nothing ever laid out
  inside the strip. NoteDock's FAB (../notes/NoteDock.jsx) floats at
  --dock-bottom, measured from the board rather than from the stage, so it
  stays exactly where it was and now overlaps the calendar's bottom-right
  corner instead of a dead band. Those 56 canvas px are what pays for the
  1.2x upscale in src/lib/canvas.js: with the canvas at 900x675 they are the
  difference between the calendar body keeping its height in screen px and
  losing 11% of it.

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

  MonthView's `.fb-cell`, DayView's `.fb-alldaychip` and MonthView's
  `.fb-monthweather` are untouched. They are flat --paper, and they now sit directly on the fully-washed board
  instead of on a faintly-washed card, so they read with more contrast
  than before, not less. WeekView's `.fb-wcol.is-today` used to be on that
  list and read as a white slab on the tinted board; it is now
  --today-shade, a darker shade of whatever the board shows behind it.
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
  flex: 1; min-height: 0;
  overflow: hidden;
  padding: 16px 18px;
}
`;
