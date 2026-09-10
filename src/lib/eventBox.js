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

export function eventTier(durMin) {
  if (durMin <= SHORT_MIN) return "condensed";
  if (durMin < STACK_MIN) return "compact";
  return "stacked";
}
