/*
  Column layout for overlapping timed events in Day/Week — the piece both
  views were missing: events with intersecting time ranges used to stack
  directly on top of each other in the same column instead of splitting
  side by side.

  Collision grouping mirrors the classic Google Calendar packing algorithm:
  sort by start time, greedily drop each event into the first column whose
  last occupant has already ended, and close a "collision group" once an
  event starts at or after every event opened so far has finished. Every
  event in a group shares that group's column count.

  `end <= start` (not `<`) is what makes a back-to-back pair (one ends
  exactly when the next starts) free to share a column — touching is not
  overlapping.

  Within a group, width is no longer divided evenly across columns (that
  squished 3-way overlaps down to ~33% lanes — too narrow for the title/time
  text at `.fb-dblock`'s 14px/11px-padding or `.fb-wblock`'s 12px/6px-padding
  sizing). Instead every event keeps a fixed, readable WIDTH_PCT and later
  columns cascade rightward by STEP_PCT, covering only the previous column's
  right edge — the same partial-overlap stagger Google Calendar uses. 40%
  is the largest step that still lets a 2-up overlap fit edge-to-edge at
  WIDTH_PCT 60 (40 + 60 = 100) with no compression; deeper groups shrink the
  step — never the width — via `(100 - WIDTH_PCT) / (cols - 1)` so the last
  column's right edge never passes 100 and events don't spill out of the
  column. Later-starting events stack on top (higher z) so the cascade reads
  correctly.
*/
const WIDTH_PCT = 60;
const STEP_PCT = 40;
const BASE_Z = 2;

export function layoutOverlaps(events) {
  const sorted = events
    .map((event, i) => ({ event, i }))
    .sort((a, b) => a.event.start - b.event.start || a.event.end - b.event.end || a.i - b.i);

  const layout = new Map();
  let group = [];
  let groupEnd = -Infinity;
  let columns = [];

  const flush = () => {
    const cols = columns.length;
    const width = cols <= 1 ? 100 : WIDTH_PCT;
    const step = cols <= 1 ? 0 : Math.min(STEP_PCT, (100 - WIDTH_PCT) / (cols - 1));
    group.forEach(({ event, col }, idx) => {
      layout.set(event, { left: col * step, width, z: BASE_Z + idx });
    });
    group = [];
    columns = [];
  };

  for (const { event } of sorted) {
    if (group.length > 0 && event.start >= groupEnd) {
      flush();
      groupEnd = -Infinity;
    }
    let col = columns.findIndex((end) => end <= event.start);
    if (col === -1) {
      col = columns.length;
      columns.push(event.end);
    } else {
      columns[col] = event.end;
    }
    group.push({ event, col });
    groupEnd = groupEnd > event.end ? groupEnd : event.end;
  }
  if (group.length > 0) flush();

  return layout;
}
