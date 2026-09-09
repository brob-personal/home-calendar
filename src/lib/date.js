/*
  Date helpers — moved verbatim from family-board.jsx:178-216, plus the three
  label tables at :218-220.

  A warning for every role downstream, and the reason R3's backlog item 2
  exists: every function here takes a live `Date`. `start`/`end` on an Event
  are live Dates with no serializer, so the first JSON round-trip turns them
  into strings and every minutesInto/sameDay call below breaks silently
  (PLAN.md §1, "Date landmine"). R2 changed nothing about that — it is R3's to
  solve.
*/

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfWeek(d) {
  const x = startOfDay(d);
  return addDays(x, -x.getDay());
}

export function minutesInto(d) {
  return d.getHours() * 60 + d.getMinutes();
}

export function daysUntil(d, from) {
  return Math.round((startOfDay(d) - startOfDay(from)) / 86400000);
}

export function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function fmtTime(d) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, "0")}${ap}` : `${h}${ap}`;
}

export function fmtClock(d) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  h = h % 12 || 12;
  return `${h}:${m}`;
}

export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DOW_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
