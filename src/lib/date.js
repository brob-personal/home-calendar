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

/*
  Whether an all-day event covers `day`. `event.end` is documented (schema.js)
  as the last day, inclusive, so this is a closed range on both ends — unlike
  Google's own exclusive end-date convention, which src/data/google.js
  converts at its own boundary rather than leaking into this contract.
*/
export function spansDay(event, day) {
  const d = startOfDay(day);
  return d >= startOfDay(event.start) && d <= startOfDay(event.end);
}

/*
  The paging step shared by Footer's chevrons and R12's swipe gesture — a
  month at a time in month view, seven days in week, one day otherwise. Pulled
  out to a pure function so the two call sites can't drift apart; see
  Footer.jsx's header comment and src/hooks/useSwipePage.js.
*/
export function stepAnchor(view, anchor, dir) {
  if (view === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return addDays(anchor, (view === "week" ? 7 : 1) * dir);
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

export function fmtRange(start, end) {
  return `${fmtTime(start)} - ${fmtTime(end)}`;
}

/* "Tue, Sep 15" — the WeatherDaySheet title, using DOW/MONTH_SHORT below
   rather than a new label table since both already exist for the same
   abbreviated style. */
export function fmtLongDate(d) {
  return `${DOW[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
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
