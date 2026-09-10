/*
  Column layout for overlapping timed events in Day/Week — the piece both
  views were missing: events with intersecting time ranges used to stack
  directly on top of each other in the same column instead of splitting
  side by side.

  This mirrors the classic Google Calendar packing algorithm: sort by start
  time, greedily drop each event into the first column whose last occupant
  has already ended, and close a "collision group" once an event starts at
  or after every event opened so far has finished. Every event in a group
  shares that group's column count, so width is 100/columns and left is
  col/columns*100 — a run of 3 mutually-overlapping events gets three ~33%
  lanes, but a later event that only overlaps one of the earlier ones can
  reuse a freed column instead of forcing a needless extra lane.

  `end <= start` (not `<`) is what makes a back-to-back pair (one ends
  exactly when the next starts) free to share a column — touching is not
  overlapping.
*/
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
    for (const { event, col } of group) {
      layout.set(event, { left: (col * 100) / cols, width: 100 / cols });
    }
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
