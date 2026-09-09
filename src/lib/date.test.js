import { describe, it, expect } from "vitest";

import { stepAnchor } from "./date.js";

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
