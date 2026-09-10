import { describe, it, expect } from "vitest";

import { stepAnchor, spansDay } from "./date.js";

/*
  R12 item 2: stepAnchor is the paging step shared by Footer's chevrons and
  the swipe gesture in useSwipePage.js. One place, one set of tests.
*/
describe("stepAnchor", () => {
  it("steps a day at a time by default", () => {
    const d = new Date(2026, 2, 15);
    expect(stepAnchor("day", d, 1)).toEqual(new Date(2026, 2, 16));
    expect(stepAnchor("agenda", d, -1)).toEqual(new Date(2026, 2, 14));
  });

  it("steps seven days at a time in week view", () => {
    const d = new Date(2026, 2, 15);
    expect(stepAnchor("week", d, 1)).toEqual(new Date(2026, 2, 22));
    expect(stepAnchor("week", d, -1)).toEqual(new Date(2026, 2, 8));
  });

  it("steps a month at a time in month view, landing on the 1st", () => {
    const d = new Date(2026, 2, 15);
    expect(stepAnchor("month", d, 1)).toEqual(new Date(2026, 3, 1));
    expect(stepAnchor("month", d, -1)).toEqual(new Date(2026, 1, 1));
  });

  it("rolls month paging across a year boundary", () => {
    expect(stepAnchor("month", new Date(2026, 11, 20), 1)).toEqual(new Date(2027, 0, 1));
  });
});

describe("spansDay", () => {
  const event = (startY, startM, startD, endY, endM, endD) => ({
    start: new Date(startY, startM, startD, 9, 0),
    end: new Date(endY, endM, endD, 17, 0),
  });

  it("matches a single-day event only on its own day", () => {
    const e = event(2026, 2, 15, 2026, 2, 15);
    expect(spansDay(e, new Date(2026, 2, 14))).toBe(false);
    expect(spansDay(e, new Date(2026, 2, 15))).toBe(true);
    expect(spansDay(e, new Date(2026, 2, 16))).toBe(false);
  });

  it("matches every day a multi-day event covers, inclusive of both ends", () => {
    const trip = event(2026, 9, 1, 2026, 9, 9); // Oct 1 - Oct 9
    expect(spansDay(trip, new Date(2026, 8, 30))).toBe(false);
    expect(spansDay(trip, new Date(2026, 9, 1))).toBe(true);
    expect(spansDay(trip, new Date(2026, 9, 5))).toBe(true);
    expect(spansDay(trip, new Date(2026, 9, 9))).toBe(true);
    expect(spansDay(trip, new Date(2026, 9, 10))).toBe(false);
  });

  it("ignores time of day, comparing calendar days only", () => {
    const e = event(2026, 2, 15, 2026, 2, 15);
    expect(spansDay(e, new Date(2026, 2, 15, 23, 59))).toBe(true);
  });
});
