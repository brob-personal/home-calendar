import { describe, it, expect } from "vitest";

import { layoutOverlaps } from "./layout.js";

function ev(id, startH, startM, endH, endM) {
  return { id, start: new Date(2026, 0, 1, startH, startM), end: new Date(2026, 0, 1, endH, endM) };
}

describe("layoutOverlaps", () => {
  it("splits two overlapping events 50/50 side by side", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 9, 30, 10, 30);
    const layout = layoutOverlaps([a, b]);
    expect(layout.get(a)).toEqual({ left: 0, width: 50 });
    expect(layout.get(b)).toEqual({ left: 50, width: 50 });
  });

  it("splits three mutually-overlapping events into three ~33% lanes", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 9, 0, 10, 0);
    const c = ev("c", 9, 0, 10, 0);
    const layout = layoutOverlaps([a, b, c]);
    expect(layout.get(a)).toEqual({ left: 0, width: 100 / 3 });
    expect(layout.get(b)).toEqual({ left: (1 * 100) / 3, width: 100 / 3 });
    expect(layout.get(c)).toEqual({ left: (2 * 100) / 3, width: 100 / 3 });
  });

  it("gives a non-overlapping pair full width each", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 14, 0, 15, 0);
    const layout = layoutOverlaps([a, b]);
    expect(layout.get(a)).toEqual({ left: 0, width: 100 });
    expect(layout.get(b)).toEqual({ left: 0, width: 100 });
  });

  it("does not treat back-to-back events (one ends when the next starts) as overlapping", () => {
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 10, 0, 11, 0);
    const layout = layoutOverlaps([a, b]);
    expect(layout.get(a)).toEqual({ left: 0, width: 100 });
    expect(layout.get(b)).toEqual({ left: 0, width: 100 });
  });

  it("reuses a freed column instead of forcing every transitively-linked event into its own lane", () => {
    // a: 9-10, b: 9:30-11:00, c: 10-10:30 — a & b overlap, b & c overlap,
    // but a & c only touch (a ends exactly when c starts). c can reuse a's
    // freed column instead of forcing a needless 3rd lane.
    const a = ev("a", 9, 0, 10, 0);
    const b = ev("b", 9, 30, 11, 0);
    const c = ev("c", 10, 0, 10, 30);
    const layout = layoutOverlaps([a, b, c]);
    expect(layout.get(a)).toEqual({ left: 0, width: 50 });
    expect(layout.get(b)).toEqual({ left: 50, width: 50 });
    expect(layout.get(c)).toEqual({ left: 0, width: 50 });
  });

  it("returns an empty layout for an empty input", () => {
    expect(layoutOverlaps([]).size).toBe(0);
  });
});
