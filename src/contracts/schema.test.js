import { describe, it, expect } from "vitest";

import { VARIATIONS } from "../lib/color.js";
import {
  ACCESS_ROLES,
  MODES,
  SCHEMA_VERSION,
  SLEEP_STYLES,
  STORE_KEYS,
  VARIATION_COUNT,
  WEATHER_CONDITIONS,
  asDate,
  clampVariant,
  normalizeCondition,
  normalizeEvent,
  normalizeMember,
  normalizeModes,
  normalizeNote,
} from "./schema.js";

/*
  The normalizers are the runtime half of the typedefs: with no TypeScript in
  the project, they are what actually stops a malformed cache entry or a
  surprising Google payload from reaching a view. So the property that matters
  most for all of them is totality — no input throws, and every output is
  renderable.
*/

describe("normalizeEvent", () => {
  it("fills every contract field from a bare draft", () => {
    const e = normalizeEvent({ id: "e1", start: "2026-09-09T10:00:00Z" });

    expect(e).toMatchObject({
      id: "e1",
      title: "Untitled",
      allDay: false,
      memberIds: [],
      variant: 0,
      milestone: false,
      location: "",
    });
    expect(e.start).toBeInstanceOf(Date);
    expect(e.end).toBeInstanceOf(Date);
  });

  it("does not throw on anything", () => {
    for (const input of [undefined, null, {}, [], "text", 42, { start: {} }]) {
      expect(() => normalizeEvent(input)).not.toThrow();
    }
  });

  it("repairs an end that precedes its start", () => {
    /* Would render as a negative-height block. */
    const e = normalizeEvent({
      id: "e1",
      start: "2026-09-09T10:00:00Z",
      end: "2026-09-09T09:00:00Z",
    });
    expect(e.end.getTime()).toBe(e.start.getTime());
  });

  it("keeps a title of whitespace out", () => {
    expect(normalizeEvent({ title: "   " }).title).toBe("Untitled");
    expect(normalizeEvent({ title: "Gym" }).title).toBe("Gym");
  });

  it("leaves the optional fields absent rather than empty", () => {
    /* R8 compares etags for its incremental sync, and "" is not a missing
       one. */
    const bare = normalizeEvent({ id: "e1" });
    expect("etag" in bare).toBe(false);
    expect("calendarId" in bare).toBe(false);

    const full = normalizeEvent({ id: "e1", etag: "abc", calendarId: "brian@gmail.com" });
    expect(full.etag).toBe("abc");
    expect(full.calendarId).toBe("brian@gmail.com");
  });

  it("keeps the per-member Google event id map when a write path set one", () => {
    /* One logical board event can produce several Google event ids — one per
       member calendar it was written to. A future edit/delete needs to find
       every copy, so the map survives normalization the same way calendarId
       and etag do: absent when never written, present verbatim otherwise. */
    const bare = normalizeEvent({ id: "e1" });
    expect("googleEventIds" in bare).toBe(false);

    const full = normalizeEvent({
      id: "e1",
      googleEventIds: { brian: "evt-brian-1", rachel: "evt-rachel-1" },
    });
    expect(full.googleEventIds).toEqual({ brian: "evt-brian-1", rachel: "evt-rachel-1" });
  });

  it("drops a malformed googleEventIds rather than throwing", () => {
    for (const bad of [null, "nope", 42, [], { brian: 5 }]) {
      const e = normalizeEvent({ id: "e1", googleEventIds: bad });
      expect("googleEventIds" in e).toBe(false);
    }
  });

  it("is idempotent", () => {
    const once = normalizeEvent({ id: "e1", title: "Gym", start: "2026-09-09T10:00:00Z" });
    expect(normalizeEvent(once)).toEqual(once);
  });

  it("stringifies member ids so a numeric id still matches", () => {
    expect(normalizeEvent({ memberIds: [1, "brian"] }).memberIds).toEqual(["1", "brian"]);
  });
});

describe("clampVariant", () => {
  it("agrees with the palette it indexes", () => {
    /* variantColor() indexes VARIATIONS with this. If the two ever disagree,
       an event renders a colour outside the pastel band — or undefined. */
    expect(VARIATION_COUNT).toBe(VARIATIONS.length);
  });

  it("keeps every Google colorId inside the palette", () => {
    /* Google numbers its colours 1-11 and R8 subtracts one. */
    for (let colorId = 1; colorId <= 11; colorId++) {
      const variant = clampVariant(colorId - 1);
      expect(variant).toBe(colorId - 1);
      expect(VARIATIONS[variant]).toBeDefined();
    }
  });

  it("wraps rather than clipping, and never goes negative", () => {
    expect(clampVariant(11)).toBe(0);
    expect(clampVariant(12)).toBe(1);
    expect(clampVariant(-1)).toBe(10);
    expect(clampVariant(-12)).toBe(10);
  });

  it("falls back to 0 for anything non-numeric", () => {
    for (const input of [undefined, null, "", "blue", NaN, {}, []]) {
      expect(clampVariant(input)).toBe(0);
    }
  });

  it("truncates a fractional variant", () => {
    expect(clampVariant(3.7)).toBe(3);
  });
});

describe("asDate", () => {
  it("accepts every form a date arrives in", () => {
    const iso = "2026-09-09T10:00:00.000Z";
    const ms = Date.parse(iso);

    expect(asDate(new Date(iso)).getTime()).toBe(ms);
    expect(asDate(iso).getTime()).toBe(ms);
    expect(asDate(ms).getTime()).toBe(ms);
    /* The serializer's envelope, for a value that skipped the reviver. */
    expect(asDate({ $date: iso }).getTime()).toBe(ms);
  });

  it("returns an invalid Date rather than throwing", () => {
    for (const input of [undefined, null, "", "not a date", {}, []]) {
      const d = asDate(input);
      expect(d).toBeInstanceOf(Date);
      expect(Number.isNaN(d.getTime())).toBe(true);
    }
  });
});

describe("normalizeMember", () => {
  it("defaults onBoard on but respects an explicit false", () => {
    expect(normalizeMember({ id: "a" }).onBoard).toBe(true);
    expect(normalizeMember({ id: "a", onBoard: false }).onBoard).toBe(false);
  });

  it("always yields a colour, since a member without one has no hue", () => {
    expect(normalizeMember({ id: "a" }).color).toBeTruthy();
    expect(normalizeMember({ id: "a", color: "" }).color).toBeTruthy();
    expect(normalizeMember({ id: "a", color: "#7EB6E8" }).color).toBe("#7EB6E8");
  });
});

describe("normalizeModes", () => {
  it("puts a member in both modes when nothing says otherwise", () => {
    /* A member in no mode is invisible in both, which is never what a
       malformed blob meant. */
    expect(normalizeModes(undefined)).toEqual(MODES);
    expect(normalizeModes([])).toEqual(MODES);
    expect(normalizeModes(["office"])).toEqual(MODES);
  });

  it("keeps a narrowed roster and de-duplicates it", () => {
    expect(normalizeModes(["roommate"])).toEqual(["roommate"]);
    expect(normalizeModes(["personal", "personal"])).toEqual(["personal"]);
  });
});

describe("normalizeNote", () => {
  it("drops strokes with no point list and coerces the rest", () => {
    const note = normalizeNote({
      key: "2026-09-09",
      strokes: [{ color: "#E0574F", width: "4", pts: [["0.1", "0.2"]] }, { color: "#000" }, null],
    });

    expect(note.strokes).toHaveLength(1);
    expect(note.strokes[0]).toEqual({ color: "#E0574F", width: 4, pts: [[0.1, 0.2]] });
  });
});

describe("normalizeCondition", () => {
  it("keeps the five icons the board has", () => {
    for (const c of WEATHER_CONDITIONS) {
      expect(normalizeCondition(c)).toBe(c);
    }
  });

  it("maps everything else to sunny, which is the spec", () => {
    /* SCOPING and PLAN.md §R6 item 2 are explicit that this is intended, not
       a shortcut — so it is pinned here rather than left to R6. */
    for (const c of ["thunderstorm", "fog", "hail", "sleet", "", null, undefined, 7]) {
      expect(normalizeCondition(c)).toBe("sunny");
    }
  });

  it("is case-insensitive, since providers are not consistent", () => {
    expect(normalizeCondition("Rain")).toBe("rain");
    expect(normalizeCondition("PARTLY")).toBe("partly");
  });
});

describe("the contract constants", () => {
  it("declares one store key per persisted slice, all distinct", () => {
    const keys = Object.values(STORE_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    /* A slice persisted under two spellings is a board that forgets one thing
       and remembers another. */
    for (const [name, key] of Object.entries(STORE_KEYS)) {
      expect(key).toBe(name);
    }
  });

  it("keeps the closed unions closed", () => {
    expect(MODES).toEqual(["personal", "roommate"]);
    expect(SLEEP_STYLES).toEqual(["black", "dim"]);
    expect(WEATHER_CONDITIONS).toHaveLength(5);
    expect(ACCESS_ROLES).toEqual(["owner", "writer", "reader", "freeBusyReader"]);
  });

  it("starts the schema at a real version", () => {
    /* Version 0 means "unstamped", so a stamped blob must be at least 1. */
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
  });
});
