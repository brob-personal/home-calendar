/*
  The two pure functions behind sleep mode, moved verbatim from
  family-board.jsx:362-373.

  isAsleep handles the midnight wrap: when bedtime is later in the day than
  wake time (the normal case — 22:00 to 06:30) the asleep window straddles
  midnight, so the test is a disjunction rather than a range. R13's backlog
  item 1 names that wrap explicitly as a case to cover.
*/
import { minutesInto } from "./date.js";

export function parseHM(s) {
  const [h, m] = String(s).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isAsleep(now, bedtime, wakeTime) {
  const mins = minutesInto(now);
  const b = parseHM(bedtime);
  const w = parseHM(wakeTime);
  return b > w ? mins >= b || mins < w : mins >= b && mins < w;
}
