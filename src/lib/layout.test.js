import { describe, it, expect } from "vitest";

import { layoutOverlaps } from "./layout.js";

function ev(id, startH, startM, endH, endM) {
  return { id, start: new Date(2026, 0, 1, startH, startM), end: new Date(2026, 0, 1, endH, endM) };
}

describe("layoutOverlaps", () => {
  it("cascades two overlapping events: fixed width, offset by the ideal step", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 9, 30, 10, 30);
    const layout = layoutOverlaps([a, b]);
    expect(layout.get(a)).toEqual({ left: 0, width: 60, z: 2 });
    expect(layout.get(b)).toEqual({ left: 40, width: 60, z: 3 });
  });

  it("cascades three mutually-overlapping events, compressing the step to fit", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 9, 0, 10, 0);
    const c = ev("c", 9, 0, 10, 0);
    const layout = layoutOverlaps([a, b, c]);
    expect(layout.get(a)).toEqual({ left: 0, width: 60, z: 2 });
    expect(layout.get(b)).toEqual({ left: 20, width: 60, z: 3 });
    expect(layout.get(c)).toEqual({ left: 40, width: 60, z: 4 });
  });

  it("compresses the step further for a deep overlap group so events stay within the column", () => {
    // 4-way overlap: the ideal 40% step would put the last event at left 120
    // (120 + 60 width = 180, way past the column's right edge). The step
    // must compress to (100 - width) / (cols - 1) = 40/3 so the last event's
    // right edge lands exactly at 100 instead of overflowing — the width
    // stays fixed at 60, only the step shrinks.
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 9, 0, 10, 0);
    const c = ev("c", 9, 0, 10, 0);
    const d = ev("d", 9, 0, 10, 0);
    const layout = layoutOverlaps([a, b, c, d]);
    const step = 40 / 3;
    expect(layout.get(a)).toEqual({ left: 0, width: 60, z: 2 });
    expect(layout.get(b)).toMatchObject({ width: 60, z: 3 });
    expect(layout.get(b).left).toBeCloseTo(step);
    expect(layout.get(c)).toMatchObject({ width: 60, z: 4 });
    expect(layout.get(c).left).toBeCloseTo(step * 2);
    expect(layout.get(d)).toMatchObject({ width: 60, z: 5 });
    expect(layout.get(d).left).toBeCloseTo(step * 3);
    // Right edge of the last (topmost) event must not overflow the column.
    expect(layout.get(d).left + layout.get(d).width).toBeCloseTo(100);
  });

  it("gives a non-overlapping pair full width each", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 14, 0, 15, 0);
    const layout = layoutOverlaps([a, b]);
    expect(layout.get(a)).toEqual({ left: 0, width: 100, z: 2 });
    expect(layout.get(b)).toEqual({ left: 0, width: 100, z: 2 });
  });

  it("does not treat back-to-back events (one ends when the next starts) as overlapping", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 10, 0, 11, 0);
    const layout = layoutOverlaps([a, b]);
    expect(layout.get(a)).toEqual({ left: 0, width: 100, z: 2 });
    expect(layout.get(b)).toEqual({ left: 0, width: 100, z: 2 });
  });

  it("reuses a freed column instead of forcing every transitively-linked event into its own lane", () => {
    // a: 9-10, b: 9:30-11:00, c: 10-10:30 — a & b overlap, b & c overlap,
    // but a & c only touch (a ends exactly when c starts). c can reuse a's
    // freed column instead of forcing a needless 3rd lane, and renders above
    // both a and b since it starts last.
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 9, 30, 11, 0);
    const c = ev("c", 10, 0, 10, 30);
    const layout = layoutOverlaps([a, b, c]);
    expect(layout.get(a)).toEqual({ left: 0, width: 60, z: 2 });
    expect(layout.get(b)).toEqual({ left: 40, width: 60, z: 3 });
    expect(layout.get(c)).toEqual({ left: 0, width: 60, z: 4 });
  });

  it("returns an empty layout for an empty input", () => {
    expect(layoutOverlaps([]).size).toBe(0);
  });
});
