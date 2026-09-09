import { describe, it, expect } from "vitest";

import { toJSON, fromJSON, roundTrip, isDateTag } from "./serialize.js";
import { normalizeEvent } from "./schema.js";

/*
  The Date landmine, tested. PLAN.md §R13 item 1 names "R3's Date reviver"
  explicitly as a unit-test target, and PLAN.md §R3's acceptance criterion is
  that a persisted, reloaded event still has live Dates.

  The assertions worth reading are the ones about *why the naive version fails*:
  plain JSON.stringify + JSON.parse turns `start` into a string that still
  renders, still compares, still sorts — and breaks the moment a view calls
  .getHours() on it. That is why the last test in the first block exists.
*/

describe("date serialization", () => {
  it("round-trips a Date as a live Date", () => {
    const d = new Date("2026-09-09T14:30:00.000Z");
    const out = roundTrip({ start: d });

    expect(out.start).toBeInstanceOf(Date);
    expect(out.start.getTime()).toBe(d.getTime());
  });

  it("writes the tagged envelope rather than a bare string", () => {
    const text = toJSON({ start: new Date("2026-01-02T03:04:05.000Z") });
    expect(JSON.parse(text)).toEqual({ start: { $date: "2026-01-02T03:04:05.000Z" } });
  });

  it("is what plain JSON cannot do — the failure this module exists to prevent", () => {
    const naive = JSON.parse(JSON.stringify({ start: new Date("2026-09-09T14:30:00Z") }));
    expect(typeof naive.start).toBe("string");
    /* A string has no getHours, so minutesInto() throws — the whole-board
       failure PLAN.md §1 calls the date landmine. */
    expect(() => naive.start.getHours()).toThrow(TypeError);

    const safe = roundTrip({ start: new Date("2026-09-09T14:30:00Z") });
    expect(() => safe.start.getHours()).not.toThrow();
  });

  it("revives Dates at any depth, in arrays and in nested objects", () => {
    const value = {
      events: [{ start: new Date(1_700_000_000_000) }],
      weather: { today: { sunrise: new Date(1_700_003_600_000) } },
      tuple: [new Date(0), [new Date(86_400_000)]],
    };
    const out = roundTrip(value);

    expect(out.events[0].start).toBeInstanceOf(Date);
    expect(out.weather.today.sunrise).toBeInstanceOf(Date);
    expect(out.tuple[0]).toBeInstanceOf(Date);
    expect(out.tuple[1][0]).toBeInstanceOf(Date);
    expect(out.tuple[1][0].getTime()).toBe(86_400_000);
  });

  it("round-trips a top-level Date", () => {
    /* The replacer reads the pre-toJSON value off its holder, and at the top
       level the holder is JSON's own `{ "": value }` wrapper. Easy to get
       wrong, invisible until something persists a bare Date. */
    const out = roundTrip(new Date("2026-03-04T05:06:07.000Z"));
    expect(out).toBeInstanceOf(Date);
    expect(out.toISOString()).toBe("2026-03-04T05:06:07.000Z");
  });

  it("keeps an invalid Date invalid instead of throwing on write", () => {
    /* new Date(NaN).toISOString() throws, so an invalid Date cannot be tagged
       with an ISO string. It reaches here from a malformed Google payload. */
    const out = roundTrip({ start: new Date("not a date") });
    expect(out.start).toBeInstanceOf(Date);
    expect(Number.isNaN(out.start.getTime())).toBe(true);
  });

  it("leaves every other JSON value alone", () => {
    const value = {
      s: "text",
      n: 0,
      neg: -1.5,
      t: true,
      f: false,
      nul: null,
      arr: [1, "two", false],
      nested: { deep: { deeper: "still fine" } },
    };
    expect(roundTrip(value)).toEqual(value);
  });

  it("does not eat a user object that merely has a $date property", () => {
    /* The tag is claimed only by an object whose single key is $date. A shape
       with more than that is data, not an envelope. */
    const value = { $date: "2026-01-01T00:00:00.000Z", label: "not an envelope" };
    const out = roundTrip({ value });

    expect(out.value).toEqual(value);
    expect(out.value.$date).toBe("2026-01-01T00:00:00.000Z");
    expect(isDateTag(value)).toBe(false);
  });

  it("recognizes only its own envelope", () => {
    expect(isDateTag({ $date: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(isDateTag({ $date: null })).toBe(true);
    expect(isDateTag({ $date: 12345 })).toBe(false);
    expect(isDateTag({ date: "2026-01-01" })).toBe(false);
    expect(isDateTag(null)).toBe(false);
    expect(isDateTag([{ $date: "2026-01-01T00:00:00.000Z" }])).toBe(false);
    expect(isDateTag("2026-01-01")).toBe(false);
  });

  it("reports malformed JSON rather than returning a partial value", () => {
    expect(() => fromJSON("{not json")).toThrow(SyntaxError);
  });
});

describe("a persisted event", () => {
  it("survives the round-trip whole, Dates included", () => {
    const event = normalizeEvent({
      id: "e1",
      title: "Dinner at the Kims'",
      start: new Date("2026-09-09T18:30:00.000Z"),
      end: new Date("2026-09-09T20:00:00.000Z"),
      memberIds: ["brian", "rachel"],
      variant: 3,
      location: "Decatur",
      milestone: false,
      allDay: false,
    });

    const revived = roundTrip(event);

    expect(revived).toEqual(event);
    expect(revived.start).toBeInstanceOf(Date);
    expect(revived.end).toBeInstanceOf(Date);
    /* The arithmetic every view does on these two fields. */
    expect(revived.end - revived.start).toBe(90 * 60 * 1000);
  });
});
