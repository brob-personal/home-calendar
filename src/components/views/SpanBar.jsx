/*
  One horizontal bar in a date-grid row — the shared rendering for Week's
  all-day band and Month's per-week event overlay, so the two cannot drift
  apart the way their per-day chip loops did.

  Geometry comes from `layoutSpans` (src/lib/spans.js) as a column index, a
  column count and a lane; `spanGeometry` below turns that into left/width.
  The `gap` arithmetic is the only subtle part. Month's cells sit in a CSS
  grid with a gap between them, so a column is not simply 100%/n of the
  track — with `n` columns and gap `g`, each column is `(100% - (n-1)g)/n`
  wide, so column `i` starts at `i * (100% + g)/n` and a bar of `span`
  columns is `span * (100% + g)/n - g` wide. That width deliberately covers
  the gaps the bar crosses, which is what makes a multi-day bar read as one
  continuous object instead of pieces aligned by eye. Week's track has no
  gap, so `g` is 0 and the same expression collapses to the plain fraction.

  Those are written out as a flat `calc(X% + Ypx)` — the percentage and
  pixel halves summed in JS — rather than as the nested `calc((100% + Ng)/n
  * i)` they come from. Two reasons, and the second is the one that bites:
  it matches the `calc(${left}% + 2px)` idiom src/lib/layout.js already
  hands the timed blocks, and jsdom's CSS parser silently drops a nested
  calc, which would leave every geometry assertion in the view tests
  reading an empty string and passing for the wrong reason.

  `inset` pulls the bar inside its cell's own horizontal padding at the two
  outer ends only — never at the joins, which would reopen the gaps.

  A bar that continues past either end of the row squares off that edge
  instead of rounding it (`is-cont-before` / `is-cont-after` in the view's
  stylesheet), the same signal Google Calendar uses to say the event runs on
  into the week before or after.
*/

/* Exported for the view tests, which assert placement without a layout engine. */
export function spanGeometry({ startIdx, span }, columns, gap = 0, inset = 0) {
  const px = (n) => `${n >= 0 ? "+" : "-"} ${Math.abs(Math.round(n * 1000) / 1000)}px`;
  return {
    left: `calc(${(startIdx / columns) * 100}% ${px((startIdx * gap) / columns + inset)})`,
    width: `calc(${(span / columns) * 100}% ${px((span * gap) / columns - gap - inset * 2)})`,
  };
}

export function SpanBar({
  bar,
  columns,
  laneH,
  className,
  fill,
  onSelect,
  gap = 0,
  inset = 0,
  children,
}) {
  const { event, lane, continuesBefore, continuesAfter } = bar;
  const edges =
    (continuesBefore ? " is-cont-before" : "") + (continuesAfter ? " is-cont-after" : "");

  return (
    <button
      className={`${className}${edges}`}
      style={{
        ...spanGeometry(bar, columns, gap, inset),
        top: lane * laneH,
        background: fill,
      }}
      onClick={(ev) => {
        ev.stopPropagation();
        onSelect(event);
      }}
    >
      {children ?? event.title}
    </button>
  );
}
