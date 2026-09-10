import { describe, it, expect } from "vitest";

import { stepAnchor, spansDay, fmtTime, fmtClock, fmtRange, fmtFullDate } from "./date.js";

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

describe("fmtTime", () => {
  it("defaults to 12-hour with a lowercase am/pm suffix", () => {
    expect(fmtTime(new Date(2000, 0, 1, 8, 0))).toBe("8a");
    expect(fmtTime(new Date(2000, 0, 1, 20, 15))).toBe("8:15p");
  });

  it("renders 24-hour with no suffix when asked", () => {
    expect(fmtTime(new Date(2000, 0, 1, 8, 0), "24")).toBe("8:00");
    expect(fmtTime(new Date(2000, 0, 1, 20, 15), "24")).toBe("20:15");
    expect(fmtTime(new Date(2000, 0, 1, 0, 5), "24")).toBe("0:05");
  });
});

describe("fmtClock", () => {
  it("defaults to 12-hour, no am/pm suffix (today's clock behavior)", () => {
    expect(fmtClock(new Date(2000, 0, 1, 15, 5))).toBe("3:05");
    expect(fmtClock(new Date(2000, 0, 1, 0, 5))).toBe("12:05");
  });

  it("renders 24-hour when asked", () => {
    expect(fmtClock(new Date(2000, 0, 1, 15, 5), "24")).toBe("15:05");
    expect(fmtClock(new Date(2000, 0, 1, 0, 5), "24")).toBe("00:05");
  });
});

describe("fmtRange", () => {
  it("passes the format through to both ends", () => {
    const start = new Date(2000, 0, 1, 8, 0);
    const end = new Date(2000, 0, 1, 9, 30);
    expect(fmtRange(start, end, "24")).toBe("08:00 - 09:30");
  });
});

describe("fmtFullDate", () => {
  it("renders the full weekday and month name", () => {
    expect(fmtFullDate(new Date(2026, 8, 9))).toBe("Wednesday, September 9");
  });
});
