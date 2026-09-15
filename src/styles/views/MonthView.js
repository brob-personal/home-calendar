/*
  Month.

  The grid's rows are `.fb-weekrow` containers now rather than cells
  directly: a multi-day event draws one bar across the days it covers, and a
  bar has to be positioned against something that spans all seven columns.
  Each row therefore holds its seven `.fb-cell`s plus `.fb-rowevents`, an
  overlay carrying every bar in that week. MonthView.jsx's CELL_GAP and
  CELL_INSET restate `.fb-grid`'s gap and `.fb-cell`'s horizontal padding to
  line the bars up with the day numbers — change either here and they have
  to change there too.
*/
export default `
/* Month */
.fb-monthwrap { display: flex; flex-direction: column; height: 100%; gap: 7px; }
.fb-monthtoolbar { display: flex; align-items: center; justify-content: space-between; }
.fb-monthweather {
  width: var(--tap-min); height: var(--tap-min);
  display: grid; place-items: center; border-radius: 999px; border: none;
  background: var(--paper); color: var(--ink);
}
.fb-monthweather[aria-pressed="true"] { box-shadow: inset 0 0 0 2px var(--now); }
.fb-monthhead {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--mute); padding: 0 6px;
}
.fb-grid { flex: 1; display: grid; gap: 6px; min-height: 0; }
.fb-weekrow {
  position: relative; min-height: 0;
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;
}
.fb-cell {
  background: var(--paper); border-radius: 9px;
  padding: 6px 7px; display: flex; flex-direction: column; gap: 4px;
  text-align: left; overflow: hidden;
}
.fb-cell.is-outside { opacity: .42; }
.fb-cell.is-today { box-shadow: inset 0 0 0 2px var(--now); }
.fb-cellnumrow { display: flex; align-items: baseline; gap: 5px; }
.fb-cellnum { font-size: 15px; font-weight: 700; letter-spacing: -.025em; }
.fb-cellhilo {
  font-size: 10px; font-weight: 600; color: var(--mute); font-variant-numeric: tabular-nums;
}
/*
  The week's bars, laid over its cells. pointer-events: none so an empty
  patch of a cell still reaches the cell's own onPick — the bars and the
  "+N more" buttons take their own events back.
*/
.fb-rowevents { position: absolute; left: 0; right: 0; pointer-events: none; overflow: hidden; }
.fb-rowevents > * { position: absolute; pointer-events: auto; }
/*
  Scoped under .fb-rowevents, and it has to be. SpanBar renders each bar as a
  button element, and Root.js's reset -- "button { font: inherit; color:
  inherit; background: none }" -- is specificity (0,1,1), which outranks a
  bare .fb-cellev at (0,1,0). A bare rule here therefore lost every font
  longhand it declared (font is a shorthand, so inheriting it resets size,
  weight AND line-height) and the bars rendered at the inherited 16px/400 in a
  normal line box clipped by their own 17px height -- a visibly different,
  much larger face than Day's and Week's titles, which are spans the reset
  never matches. The descendant selector takes this to (0,2,0) and the
  declarations below actually apply. Keep it scoped.

  height and line-height match at 17px rather than padding around a short
  line-height, which is what keeps a descender's tail from being cut off
  against the bar's own overflow. The bar geometry is deliberately held at
  17px now that the type inside it is 7px: the line box is generous instead of
  exact, the title centres in it, and MonthView.jsx's lane arithmetic does not
  move. These two must stay equal, and MonthView.jsx's LANE_H must stay
  17 + its gap.
*/
.fb-rowevents .fb-cellev {
  font-size: 7px; font-weight: 600; color: var(--ink-on-color);
  padding: 0 6px; border-radius: 4px; height: 17px; line-height: 17px;
  text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* A bar running on into the week before or after squares off that end. */
.fb-cellev.is-cont-before { border-top-left-radius: 0; border-bottom-left-radius: 0; }
.fb-cellev.is-cont-after { border-top-right-radius: 0; border-bottom-right-radius: 0; }
/* A button element too, so scoped for the same reason as .fb-cellev above --
   a bare rule lost both its size and its --mute ink to the reset. */
.fb-rowevents .fb-cellmore {
  font-size: 7px; font-weight: 600; color: var(--mute); height: 17px; line-height: 17px;
  padding-left: 2px; text-align: left; white-space: nowrap; overflow: hidden;
}
`;
