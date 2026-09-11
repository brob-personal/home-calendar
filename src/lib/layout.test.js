import { describe, it, expect } from "vitest";

import { CANVAS_W } from "./canvas.js";
import { layoutOverlaps, trackColumnWidth, TRACK_W, MIN_EVENT_COL_W } from "./layout.js";

function ev(id, startH, startM, endH, endM) {
  return { id, start: new Date(2026, 0, 1, startH, startM), end: new Date(2026, 0, 1, endH, endM) };
}

/* The two widths that actually occur on the board: a Week day column, and a
   Day column when two members are shown. They sit on opposite sides of the
   min-width floor — Week fits one readable column, wide Day fits four — so
   between them they exercise both branches. */
const WEEK_COL = trackColumnWidth(7);
const DAY_COL_2 = trackColumnWidth(2);

/* Every rendered column, in px, for a given layout at a given column width. */
function widthsPx(result, colW) {
  return [...result.boxes.values()].map((b) => (b.width / 100) * colW);
}

describe("track geometry", () => {
  it("derives the column track from the fixed canvas, not from measurement", () => {
    // 1080 canvas - 2x24 board padding - 2x18 stage padding - 56 gutter.
    expect(TRACK_W).toBe(CANVAS_W - 48 - 36 - 56);
    expect(TRACK_W).toBe(940);
  });

  it("divides the track by the column count", () => {
    expect(trackColumnWidth(7)).toBeCloseTo(134.29, 2);
    expect(trackColumnWidth(2)).toBe(470);
    // A view with no columns must not produce Infinity.
    expect(trackColumnWidth(0)).toBe(TRACK_W);
  });
});

describe("layoutOverlaps grouping", () => {
  it("gives a non-overlapping pair full width each, with no overflow", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 14, 0, 15, 0);
    const { boxes, overflow } = layoutOverlaps([a, b], WEEK_COL);
    expect(boxes.get(a)).toEqual({ left: 0, width: 100, z: 2 });
    expect(boxes.get(b)).toEqual({ left: 0, width: 100, z: 2 });
    expect(overflow).toEqual([]);
  });

  it("does not treat back-to-back events (one ends when the next starts) as overlapping", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 10, 0, 11, 0);
    const { boxes, overflow } = layoutOverlaps([a, b], WEEK_COL);
    expect(boxes.get(a)).toEqual({ left: 0, width: 100, z: 2 });
    expect(boxes.get(b)).toEqual({ left: 0, width: 100, z: 2 });
    expect(overflow).toEqual([]);
  });

  it("reuses a freed column instead of forcing every transitively-linked event into its own lane", () => {
    // a: 9-10, b: 9:30-11:00, c: 10-10:30 — a & b overlap, b & c overlap, but
    // a & c only touch (a ends exactly when c starts). c can reuse a's freed
    // column rather than forcing a needless 3rd lane, so the group needs two
    // columns, not three, and at a wide Day column all three fit.
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 9, 30, 11, 0);
    const c = ev("c", 10, 0, 10, 30);
    const { boxes, overflow } = layoutOverlaps([a, b, c], DAY_COL_2);
    expect(boxes.get(a)).toEqual({ left: 0, width: 50, z: 2 });
    expect(boxes.get(b)).toEqual({ left: 50, width: 50, z: 2 });
    expect(boxes.get(c)).toEqual({ left: 0, width: 50, z: 2 });
    expect(overflow).toEqual([]);
  });

  it("returns an empty layout for an empty input", () => {
    const { boxes, overflow } = layoutOverlaps([], WEEK_COL);
    expect(boxes.size).toBe(0);
    expect(overflow).toEqual([]);
  });
});

describe("layoutOverlaps min-width floor", () => {
  it("splits a wide column evenly while every share still clears the floor", () => {
    // 470px / 3 = 156px each: no reason to hide anything.
    const group = [ev("a", 9, 0, 10, 0), ev("b", 9, 0, 10, 0), ev("c", 9, 0, 10, 0)];
    const result = layoutOverlaps(group, DAY_COL_2);
    expect(result.boxes.size).toBe(3);
    expect(result.overflow).toEqual([]);
    for (const px of widthsPx(result, DAY_COL_2)) expect(px).toBeGreaterThanOrEqual(MIN_EVENT_COL_W);
  });

  it("stops shrinking at the floor and hides the excess instead", () => {
    // 470px fits floor(470/96) = 4 columns. A 5-way overlap does not get five
    // 94px columns; it gets four columns out of the width left after the chip
    // lane, and the fifth event becomes the chip.
    const group = Array.from({ length: 5 }, (_, i) => ev(`e${i}`, 9, 0, 10, 0));
    const result = layoutOverlaps(group, DAY_COL_2);
    expect(result.boxes.size).toBe(4);
    expect(result.overflow).toHaveLength(1);
    expect(result.overflow[0].hidden).toHaveLength(1);
    for (const px of widthsPx(result, DAY_COL_2)) expect(px).toBeGreaterThanOrEqual(MIN_EVENT_COL_W);
  });

  it("collapses any overlap in a Week column, which only fits one readable lane", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 9, 30, 10, 30);
    const { boxes, overflow } = layoutOverlaps([a, b], WEEK_COL);
    expect(boxes.get(a)).toEqual({ left: 0, width: 75, z: 2 });
    expect(boxes.has(b)).toBe(false);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].hidden).toEqual([b]);
    // The one lane that does render is still wider than the floor, and the
    // chip takes the rest of the column's right edge.
    expect((75 / 100) * WEEK_COL).toBeGreaterThanOrEqual(MIN_EVENT_COL_W);
    expect(overflow[0].left + overflow[0].width).toBeCloseTo(100);
  });

  it("never renders a column under the floor, at any overlap depth or column width", () => {
    // The regression this whole change exists to prevent: a title box narrower
    // than the text can render in. Depth must not be able to cause it.
    for (const colW of [WEEK_COL, trackColumnWidth(4), DAY_COL_2, trackColumnWidth(1)]) {
      for (let n = 1; n <= 8; n++) {
        const group = Array.from({ length: n }, (_, i) => ev(`e${i}`, 9, 0, 10, 0));
        const result = layoutOverlaps(group, colW);
        expect(result.boxes.size).toBeGreaterThan(0);
        for (const px of widthsPx(result, colW)) {
          expect(px).toBeGreaterThanOrEqual(MIN_EVENT_COL_W);
        }
        // Nothing is silently dropped: every event either has a box or is
        // named by a chip.
        const hidden = result.overflow.flatMap((o) => o.hidden);
        expect(result.boxes.size + hidden.length).toBe(n);
      }
    }
  });

  it("keeps the rendered columns inside the column, chip lane included", () => {
    const group = Array.from({ length: 6 }, (_, i) => ev(`e${i}`, 9, 0, 10, 0));
    const { boxes, overflow } = layoutOverlaps(group, DAY_COL_2);
    const rightmost = Math.max(...[...boxes.values()].map((b) => b.left + b.width));
    expect(rightmost).toBeLessThanOrEqual(overflow[0].left + 0.001);
    expect(overflow[0].left + overflow[0].width).toBeCloseTo(100);
  });

  it("falls back to the full track when given no usable column width", () => {
    const group = [ev("a", 9, 0, 10, 0), ev("b", 9, 0, 10, 0)];
    expect(layoutOverlaps(group, undefined).boxes.size).toBe(2);
    expect(layoutOverlaps(group, 0).boxes.size).toBe(2);
  });
});

describe("layoutOverlaps overflow chips", () => {
  it("spans the hidden events' full range and lists the whole slot, not just the remainder", () => {
    const a = ev("a", 9, 0, 11, 0);
    const b = ev("b", 9, 30, 10, 0);
    const c = ev("c", 9, 45, 10, 30);
    const { boxes, overflow } = layoutOverlaps([a, b, c], WEEK_COL);
    expect(boxes.has(a)).toBe(true);
    expect(overflow).toHaveLength(1);
    const [chip] = overflow;
    expect(chip.hidden.map((e) => e.id)).toEqual(["b", "c"]);
    expect(chip.start).toEqual(b.start);
    expect(chip.end).toEqual(c.end);
    // The visible event is in the list too — the chip opens the slot, not the
    // arbitrary set of events that lost a column.
    expect(chip.events.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(chip.z).toBe(3);
  });

  it("emits one chip per run of hidden events, not one per collision group", () => {
    // One collision group (a spans the lot), but the two hidden events are an
    // hour apart — one chip stretched over the gap would claim a slot that
    // isn't crowded.
    const a = ev("a", 9, 0, 12, 0);
    const b = ev("b", 9, 30, 10, 0);
    const c = ev("c", 11, 0, 11, 30);
    const { overflow } = layoutOverlaps([a, b, c], WEEK_COL);
    expect(overflow).toHaveLength(2);
    expect(overflow[0].hidden.map((e) => e.id)).toEqual(["b"]);
    expect(overflow[0].end).toEqual(b.end);
    expect(overflow[1].hidden.map((e) => e.id)).toEqual(["c"]);
    expect(overflow[1].start).toEqual(c.start);
    // Distinct React keys, or the second chip would not render.
    expect(overflow[0].key).not.toBe(overflow[1].key);
  });

  it("merges a chain of hidden events into one chip spanning the whole chain", () => {
    const a = ev("a", 9, 0, 13, 0);
    const b = ev("b", 9, 30, 10, 30);
    const c = ev("c", 10, 0, 11, 0);
    const { overflow } = layoutOverlaps([a, b, c], WEEK_COL);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].hidden.map((e) => e.id)).toEqual(["b", "c"]);
    expect(overflow[0].start).toEqual(b.start);
    expect(overflow[0].end).toEqual(c.end);
  });
});
