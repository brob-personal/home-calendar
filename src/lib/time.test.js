import { describe, it, expect } from "vitest";

import { parseTimeText, durationLabel, wrapDuration } from "./time.js";

describe("parseTimeText", () => {
  it("parses a bare hour as that hour, on the hour", () => {
    expect(parseTimeText("8")).toBe(8 * 60);
  });

  it("parses HH:MM with no suffix as 24-hour", () => {
    expect(parseTimeText("20:15")).toBe(20 * 60 + 15);
    expect(parseTimeText("0:05")).toBe(5);
  });

  it("parses a 12-hour value with an am/pm suffix, with or without a colon", () => {
    expect(parseTimeText("8:15am")).toBe(8 * 60 + 15);
    expect(parseTimeText("8:15pm")).toBe(20 * 60 + 15);
    expect(parseTimeText("815pm")).toBe(20 * 60 + 15);
    expect(parseTimeText("8:15 AM")).toBe(8 * 60 + 15);
  });

  it("treats 12am as midnight and 12pm as noon", () => {
    expect(parseTimeText("12am")).toBe(0);
    expect(parseTimeText("12pm")).toBe(12 * 60);
  });

  it("rejects an out-of-range 24-hour value", () => {
    expect(parseTimeText("25:00")).toBeNull();
  });

  it("rejects an out-of-range 12-hour value", () => {
    expect(parseTimeText("13pm")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseTimeText("abc")).toBeNull();
    expect(parseTimeText("")).toBeNull();
    expect(parseTimeText("8:75")).toBeNull();
  });
});

describe("durationLabel", () => {
  it("renders minutes under an hour", () => {
    expect(durationLabel(15)).toBe("15 mins");
    expect(durationLabel(1)).toBe("1 min");
  });

  it("renders whole hours", () => {
    expect(durationLabel(60)).toBe("1 hr");
    expect(durationLabel(120)).toBe("2 hrs");
  });

  it("renders hours plus minutes", () => {
    expect(durationLabel(90)).toBe("1 hr 30 mins");
    expect(durationLabel(75)).toBe("1 hr 15 mins");
  });
});

describe("wrapDuration", () => {
  it("returns a plain positive difference when end is after start", () => {
    expect(wrapDuration(9 * 60, 8 * 60)).toBe(60);
  });

  it("wraps past midnight when end is before start", () => {
    expect(wrapDuration(7 * 60, 8 * 60)).toBe(23 * 60);
  });

  it("treats an identical end and start as a full 24 hours, never zero", () => {
    expect(wrapDuration(8 * 60, 8 * 60)).toBe(1440);
  });
});
