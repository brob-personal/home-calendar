import { describe, it, expect } from "vitest";

import { layoutSpans, NO_LANE_CAP } from "./spans.js";
import { addDays } from "./date.js";

// Sun Mar 15 2026 - Sat Mar 21 2026.
const WEEK_START = new Date(2026, 2, 15);
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(WEEK_START, i));

function allDay(id, startDay, endDay) {
  return {
    id,
    title: id,
    start: new Date(2026, 2, startDay),
    end: new Date(2026, 2, endDay),
    allDay: true,
  };
}

function timed(id, day, startH) {
  return {
    id,
    title: id,
    start: new Date(2026, 2, day, startH, 0),
    end: new Date(2026, 2, day, startH + 1, 0),
    allDay: false,
  };
}

function barFor(result, id) {
  return result.bars.find((b) => b.event.id === id);
}

describe("layoutSpans footprints", () => {
  it("gives a single-day all-day event a span of one at its own column", () => {
    const { bars } = layoutSpans([allDay("holiday", 16, 16)], WEEK);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ startIdx: 1, span: 1 });
  });

  it("spans an all-day event across every day it covers, end inclusive", () => {
    const { bars } = layoutSpans([allDay("trip", 16, 19)], WEEK);
    expect(bars[0]).toMatchObject({ startIdx: 1, span: 4 });
  });

  it("clamps an event that starts before the row and flags the left edge", () => {
    // Fri Mar 13 - Wed Mar 18, against a Sun Mar 15 row.
    const { bars } = layoutSpans([allDay("trip", 13, 18)], WEEK);
    expect(bars[0]).toMatchObject({
      startIdx: 0,
      span: 4,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("clamps an event that runs past the row and flags the right edge", () => {
    const { bars } = layoutSpans([allDay("trip", 19, 25)], WEEK);
    expect(bars[0]).toMatchObject({
      startIdx: 4,
      span: 3,
      continuesBefore: false,
      continuesAfter: true,
    });
  });

  it("flags both edges for an event that swallows the whole row", () => {
    const { bars } = layoutSpans([allDay("trip", 10, 30)], WEEK);
    expect(bars[0]).toMatchObject({
      startIdx: 0,
      span: 7,
      continuesBefore: true,
      continuesAfter: true,
    });
  });

  it("drops events that miss the row entirely", () => {
    const { bars } = layoutSpans([allDay("before", 8, 10), allDay("after", 24, 26)], WEEK);
    expect(bars).toHaveLength(0);
  });

  it("keeps a timed event on its start day only", () => {
    const { bars } = layoutSpans([timed("standup", 17, 9)], WEEK);
    expect(bars[0]).toMatchObject({ startIdx: 2, span: 1 });
  });
});

describe("layoutSpans lanes", () => {
  it("stacks two events that share a day into separate lanes", () => {
    const r = layoutSpans([allDay("a", 15, 17), allDay("b", 16, 18)], WEEK);
    expect(barFor(r, "a").lane).toBe(0);
    expect(barFor(r, "b").lane).toBe(1);
    expect(r.lanes).toBe(2);
  });

  it("reuses lane 0 for events that do not touch", () => {
    const r = layoutSpans([allDay("a", 15, 16), allDay("b", 18, 20)], WEEK);
    expect(barFor(r, "a").lane).toBe(0);
    expect(barFor(r, "b").lane).toBe(0);
    expect(r.lanes).toBe(1);
  });

  it("treats back-to-back days as overlapping, since each owns its whole cell", () => {
    const r = layoutSpans([allDay("a", 15, 16), allDay("b", 16, 17)], WEEK);
    expect(barFor(r, "b").lane).toBe(1);
  });

  it("puts the longer bar above a shorter one starting the same day", () => {
    const r = layoutSpans([allDay("short", 16, 16), allDay("long", 16, 20)], WEEK);
    expect(barFor(r, "long").lane).toBe(0);
    expect(barFor(r, "short").lane).toBe(1);
  });

  it("puts all-day bars above timed events on the same day", () => {
    const r = layoutSpans([timed("standup", 16, 9), allDay("trip", 15, 18)], WEEK);
    expect(barFor(r, "trip").lane).toBe(0);
    expect(barFor(r, "standup").lane).toBe(1);
  });

  it("orders timed events on one day by start time", () => {
    const r = layoutSpans([timed("late", 16, 15), timed("early", 16, 8)], WEEK);
    expect(barFor(r, "early").lane).toBe(0);
    expect(barFor(r, "late").lane).toBe(1);
  });

  it("lets a bar slot into a gap left open in an upper lane", () => {
    // `a` occupies lane 0 for Sun-Mon; `c` fits beside it rather than below.
    const r = layoutSpans([allDay("a", 15, 16), allDay("b", 15, 20), allDay("c", 18, 20)], WEEK);
    expect(barFor(r, "b").lane).toBe(0);
    expect(barFor(r, "a").lane).toBe(1);
    expect(barFor(r, "c").lane).toBe(1);
  });
});

describe("layoutSpans overflow", () => {
  it("reports no overflow when everything fits under the cap", () => {
    const r = layoutSpans([allDay("a", 16, 16), allDay("b", 16, 16)], WEEK, { maxLanes: 3 });
    expect(r.bars).toHaveLength(2);
    expect(r.more.every((n) => n === 0)).toBe(true);
    expect(r.moreLane).toBe(-1);
  });

  it("surrenders the last visible lane to a count once a day overflows", () => {
    const events = ["a", "b", "c", "d"].map((id) => allDay(id, 16, 16));
    const r = layoutSpans(events, WEEK, { maxLanes: 3 });
    // Cap 3, day overflows, so lanes 0-1 draw and lane 2 becomes "+2 more".
    expect(r.bars.map((b) => b.event.id)).toEqual(["a", "b"]);
    expect(r.more[1]).toBe(2);
    expect(r.moreLane).toBe(2);
    expect(r.lanes).toBe(3);
  });

  it("keeps a wide bar that still clears the cutoff on its busiest day", () => {
    const r = layoutSpans(
      [allDay("x", 16, 16), allDay("y", 16, 16), allDay("z", 16, 16), allDay("wide", 15, 20)],
      WEEK,
      { maxLanes: 2 },
    );
    // `wide` leads the row and takes lane 0. Monday's stack of four drops
    // its cutoff to 1, which lane 0 still clears — so the bar survives and
    // only the three single-day events fall into Monday's count.
    expect(barFor(r, "wide").lane).toBe(0);
    expect(r.more[1]).toBe(3);
    expect(r.more.filter((_, i) => i !== 1).every((n) => n === 0)).toBe(true);
  });

  it("hides a bar whole rather than truncating it mid-span", () => {
    const r = layoutSpans(
      [allDay("p", 15, 20), allDay("q", 15, 20), allDay("wide", 16, 18), allDay("extra", 16, 16)],
      WEEK,
      { maxLanes: 3 },
    );
    // `wide` sits in lane 2 and crosses Mon-Wed. Only Monday overflows, but
    // a bar cannot be visible Tue-Wed and absent Monday, so it is dropped
    // everywhere and counted on all three days.
    expect(barFor(r, "p").lane).toBe(0);
    expect(barFor(r, "q").lane).toBe(1);
    expect(barFor(r, "wide")).toBeUndefined();
    expect(r.more.slice(0, 5)).toEqual([0, 2, 1, 1, 0]);
  });

  it("counts overflow per day, not per row", () => {
    const events = [
      allDay("a", 16, 16),
      allDay("b", 16, 16),
      allDay("c", 16, 16),
      allDay("d", 18, 18),
    ];
    const r = layoutSpans(events, WEEK, { maxLanes: 2 });
    // Monday overflows, so its cutoff is 1: only lane 0 draws there and the
    // other two are counted. Wednesday is untouched.
    expect(r.more[1]).toBe(2);
    expect(r.more[3]).toBe(0);
    expect(barFor(r, "d")).toBeDefined();
  });

  it("never truncates when the cap is lifted", () => {
    const events = Array.from({ length: 6 }, (_, i) => allDay(`e${i}`, 16, 16));
    const r = layoutSpans(events, WEEK, { maxLanes: NO_LANE_CAP });
    expect(r.bars).toHaveLength(6);
    expect(r.lanes).toBe(6);
    expect(r.more.every((n) => n === 0)).toBe(true);
  });
});
