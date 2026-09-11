import { startOfDay } from "./date.js";

/*
  Horizontal span layout for the date-grid views — the piece Week's all-day
  band and Month's cells were both missing.

  Both views used to ask, per day, "which events touch this day?" and render
  a chip for each answer. A four-day trip therefore drew four separate
  chips with no visual link between them; nothing said they were one event.
  Google Calendar draws one continuous bar instead, and this module is the
  geometry for that: given a contiguous run of days (a week row), it answers
  "which events cross this run, how far does each reach, and which
  horizontal lane does each sit in" once, for every event, instead of
  per-cell.

  The day range is always contiguous and always a single row — Week passes
  its seven days, Month passes one week row at a time — so an event's
  footprint inside it is a single closed interval [startIdx, endIdx] and
  never needs to wrap. An event reaching past either edge is clamped there
  and flagged (`continuesBefore` / `continuesAfter`) so the view can square
  off that end of the bar rather than rounding it, the same way Google marks
  a bar that runs on into the next week.

  Lane packing is first-fit over the row: walk the events in reading order
  and drop each into the lowest lane whose every column it needs is still
  free. Reading order is what makes the result look deliberate rather than
  arbitrary — a bar entering from the left edge should sit above one that
  starts mid-row, and a long bar above a short one starting the same day,
  because that is the order the eye scans them.

  `maxLanes` exists for Month, where a cell is ~84px tall in a five-row
  month and ~69px in a six-row one: only two or three lanes physically fit.
  Overflow is resolved the way Google resolves it — a day with more events
  than fit gives up its last visible lane to a "+N more" affordance, and an
  event is drawn only if it clears the cutoff on *every* day it crosses,
  since a bar cannot be half-hidden. Week passes Infinity and gets no
  cutoff at all.
*/

export const NO_LANE_CAP = Infinity;

/*
  Reading order, not chronological order. Multi-day bars lead so they form a
  stable band across the top of the row; a bar continuing in from the left
  leads its own start day (a negative startIdx sorts first) so it stays
  above bars that begin inside the row.
*/
function readingOrder(a, b) {
  const aBar = a.span > 1 || a.event.allDay;
  const bBar = b.span > 1 || b.event.allDay;
  if (aBar !== bBar) return aBar ? -1 : 1;
  if (a.rawStart !== b.rawStart) return a.rawStart - b.rawStart;
  if (a.span !== b.span) return b.span - a.span;
  if (a.event.start - b.event.start !== 0) return a.event.start - b.event.start;
  return String(a.event.id).localeCompare(String(b.event.id));
}

/*
  An event's closed [startIdx, endIdx] footprint in `days`, or null if it
  misses the row entirely. An all-day event's `end` is the last day
  inclusive (schema.js); a timed event occupies only its start day, matching
  what both views rendered before this module existed.
*/
function footprint(event, days) {
  const first = startOfDay(days[0]).getTime();
  const last = startOfDay(days[days.length - 1]).getTime();
  const from = startOfDay(event.start).getTime();
  const to = event.allDay ? startOfDay(event.end).getTime() : from;
  if (to < first || from > last) return null;

  const dayMs = 86400000;
  const rawStart = Math.round((from - first) / dayMs);
  const rawEnd = Math.round((to - first) / dayMs);
  const startIdx = Math.max(rawStart, 0);
  const endIdx = Math.min(rawEnd, days.length - 1);
  return {
    event,
    startIdx,
    span: endIdx - startIdx + 1,
    rawStart,
    continuesBefore: rawStart < 0,
    continuesAfter: rawEnd > days.length - 1,
  };
}

export function layoutSpans(events, days, { maxLanes = NO_LANE_CAP } = {}) {
  const more = days.map(() => 0);
  if (days.length === 0) return { bars: [], more, lanes: 0 };

  const placed = [];
  const lanes = []; // lanes[l][col] — is that lane occupied on that column
  for (const item of events
    .map((e) => footprint(e, days))
    .filter(Boolean)
    .sort(readingOrder)) {
    const cols = Array.from({ length: item.span }, (_, i) => item.startIdx + i);
    let lane = lanes.findIndex((row) => cols.every((c) => !row[c]));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(days.map(() => false));
    }
    for (const c of cols) lanes[lane][c] = true;
    placed.push({ ...item, lane });
  }

  /*
    A day whose stack is taller than the cap surrenders its last visible
    lane to "+N more", so its cutoff is one lower than a day that fits.
    A bar is drawn only if it clears the strictest cutoff among the days it
    crosses — anything else would leave a bar visible on one day and
    truncated mid-span on the next.
  */
  const depth = days.map((_, c) => {
    let d = 0;
    for (let l = 0; l < lanes.length; l++) if (lanes[l][c]) d = l + 1;
    return d;
  });
  const cutoff = depth.map((d) => (d > maxLanes ? maxLanes - 1 : maxLanes));

  const bars = [];
  for (const item of placed) {
    const cols = Array.from({ length: item.span }, (_, i) => item.startIdx + i);
    if (cols.every((c) => item.lane < cutoff[c])) {
      bars.push(item);
    } else {
      for (const c of cols) more[c] += 1;
    }
  }

  const used = bars.reduce((n, b) => Math.max(n, b.lane + 1), 0);
  const moreLane = more.some((n) => n > 0) ? maxLanes - 1 : -1;
  return { bars, more, moreLane, lanes: Math.max(used, moreLane + 1) };
}
