import { CANVAS_W } from "./canvas.js";

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

  Width allocation has now been through three generations, and the failure
  mode of each is why the current one looks the way it does:

    1. Even split across every column. A 4-way overlap gave each event 25%
       of a 134px Week column — 33px, narrower than the word "Test" — so
       titles wrapped and then got sheared off mid-word by the block's
       duration-derived height.
    2. Fixed 60% width with `left` cascading rightward by a step that shrank
       as the group deepened. The boxes stayed nominally readable but each
       one covered the right edge of the one before it, so at 4-way overlap
       only ~13% of a lower box (18px) was actually visible. Same
       illegibility, arrived at by a different route.
    3. This one: side by side again, but with a hard floor. No column is
       ever allowed narrower than MIN_EVENT_COL_W. If the group needs more
       columns than fit at that floor, the extra columns are not rendered at
       all — they collapse into a single "+N" chip in a reserved lane on the
       right, the same "more than fits" idiom MonthView's `.fb-cellmore`
       already uses for a crowded day cell. Legibility stops being a
       function of how many events happen to overlap.

  Everything here is derived from the fixed canvas (canvas.js), not measured:
  the board is letterboxed rather than reflowed, so a Week day column is
  always 134px and a Day member column is always 940/N px. That is what lets
  a px floor be enforced through percentages without a ResizeObserver.
*/

/* The only horizontal insets between the 1080px canvas and the Day/Week
   grid: .fb-board's 24px side padding (styles/shell/Root.js) and .fb-stage's
   18px (styles/shell/Countdowns.js). .fb-gutter (styles/views/WeekView.js)
   then takes the first 56px of the grid itself for the hour labels. What is
   left is the track the day/member columns divide between them.
   layout.test.js pins this arithmetic, so a padding change in either
   stylesheet fails loudly here instead of silently shifting the threshold
   at which overlaps start collapsing. */
const BOARD_PAD_X = 24;
const STAGE_PAD_X = 18;
const GUTTER_W = 56;
export const TRACK_W = CANVAS_W - 2 * BOARD_PAD_X - 2 * STAGE_PAD_X - GUTTER_W;

/* The floor, in px. At .fb-wblock's 12px/700 title plus its 6px side padding
   and the .fb-wbtime start time beside it, a compact Week block needs ~90px
   before the title starts ellipsing away to nothing; Day's 14px title needs
   more. 96 is the round number above that, and it is the single knob for how
   aggressively overlaps collapse: raise it and they collapse sooner, lower it
   and narrower columns are allowed. */
export const MIN_EVENT_COL_W = 96;

/* Width of the lane reserved on the right of a column for its "+N" chip,
   taken out of the space the event columns divide up — so the columns that
   do render are still at least MIN_EVENT_COL_W wide once a group overflows,
   not MIN_EVENT_COL_W minus the chip. Capped at a quarter of the column so a
   hypothetically tiny column cannot end up with a negative event width. */
export const MORE_LANE_W = 34;

const BASE_Z = 2;

/* Width of one day/member column — the `colW` layoutOverlaps takes. Week
   always divides the track by 7, Day by however many members are shown. */
export function trackColumnWidth(columns) {
  return TRACK_W / Math.max(1, columns);
}

/* The hidden events, grouped into as few chips as possible: one per run of
   mutually-overlapping hidden events, spanning that run's full extent. A
   collision group is a chain of overlaps rather than one contiguous block of
   time, so a single group can legitimately need more than one chip. */
function overflowChips(hidden, group, colW, lane) {
  const clusters = [];
  [...hidden]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .forEach((event) => {
      const open = clusters[clusters.length - 1];
      if (open && event.start < open.end) {
        if (event.end > open.end) open.end = event.end;
        open.hidden.push(event);
      } else {
        clusters.push({ start: event.start, end: event.end, hidden: [event] });
      }
    });

  const left = ((colW - lane) / colW) * 100;
  const width = (lane / colW) * 100;

  return clusters.map((cluster) => ({
    key: `more-${+cluster.start}-${+cluster.end}`,
    start: cluster.start,
    end: cluster.end,
    hidden: cluster.hidden,
    /* What the chip opens: every event in the slot, including the ones that
       did get a column, so the sheet reads as the full picture for that time
       range rather than an arbitrary remainder. */
    events: group
      .map(({ event }) => event)
      .filter((e) => e.start < cluster.end && e.end > cluster.start)
      .sort((a, b) => a.start - b.start || a.end - b.end),
    left,
    width,
    z: BASE_Z + 1,
  }));
}

/*
  Returns { boxes, overflow }:

    - boxes: Map of event -> { left, width, z }, as percentages of one
      day/member column. An event absent from the map is one the caller must
      not render — it is accounted for in `overflow` instead.
    - overflow: the "+N" chips. Each carries the start/end of the slot it
      covers, its own left/width/z, the `hidden` events it stands in for, and
      the full `events` list for that slot.
*/
export function layoutOverlaps(events, colW) {
  const columnW = Number.isFinite(colW) && colW > 0 ? colW : TRACK_W;

  const sorted = events
    .map((event, i) => ({ event, i }))
    .sort((a, b) => a.event.start - b.event.start || a.event.end - b.event.end || a.i - b.i);

  const boxes = new Map();
  const overflow = [];
  let group = [];
  let groupEnd = -Infinity;
  let columns = [];

  const flush = () => {
    const cols = columns.length;
    /* How many columns fit at the floor. Always at least one: a lone event
       renders full width however narrow its column is, because there is no
       alternative that shows more of it. */
    const capacity = Math.max(1, Math.floor(columnW / MIN_EVENT_COL_W));

    if (cols <= capacity) {
      const width = 100 / cols;
      group.forEach(({ event, col }) => {
        boxes.set(event, { left: col * width, width, z: BASE_Z });
      });
    } else {
      const lane = Math.min(MORE_LANE_W, columnW / 4);
      const usable = columnW - lane;
      /* Strictly fewer than cols, since usable < columnW and cols is already
         greater than floor(columnW / MIN_EVENT_COL_W) — so this branch always
         hides at least one event and the chip is never a lie. */
      const visible = Math.max(1, Math.min(cols, Math.floor(usable / MIN_EVENT_COL_W)));
      const width = (usable / visible / columnW) * 100;
      const hidden = [];
      group.forEach(({ event, col }) => {
        if (col < visible) boxes.set(event, { left: col * width, width, z: BASE_Z });
        else hidden.push(event);
      });
      overflow.push(...overflowChips(hidden, group, columnW, lane));
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

  return { boxes, overflow };
}
