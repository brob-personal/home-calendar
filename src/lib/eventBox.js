/*
  Shared sizing tiers for timed event blocks in Day/Week, so the two grids
  don't drift apart on what counts as "short" or "stacked."

  - <=15min: condensed tier — every block gets the same fixed height (the
    height of a 15-minute slot), single row of "Title  Start".
  - 15-45min: compact tier — height grows with actual duration, still a
    single row of "Title  Start".
  - >=45min: stacked tier — height grows with actual duration, two rows:
    title, then the full "Start - End" range.
*/
export const SHORT_MIN = 15;
export const STACK_MIN = 45;

/*
  Minimum rendered height, in px, for the "+N" overflow chip Day/Week show
  when more events overlap than there is readable column width for
  (src/lib/layout.js). The chip spans its slot's real time range like a
  block does, but unlike a block it is a control with nothing else to fall
  back on, so a slot made of 15-minute events (8.5px at HOUR_H 34) would be
  effectively untappable. 20px is the floor; the slot's own height wins
  above that.
*/
export const MORE_MIN_H = 20;

export function eventTier(durMin) {
  if (durMin <= SHORT_MIN) return "condensed";
  if (durMin < STACK_MIN) return "compact";
  return "stacked";
}
