import { describe, it, expect } from "vitest";

import { THEMES } from "../lib/theme.js";
import {
  migrate,
  migrateSettings,
  migrateEvents,
  migrateNotes,
  migrateMembers,
} from "./migrate.js";
import { DEFAULT_SETTINGS } from "./defaults.js";
import { SCHEMA_VERSION } from "./schema.js";

/*
  PLAN.md §R3's acceptance criterion for this file: "Settings from before the
  migration load without loss."

  `V0_SETTINGS` is that blob — the twelve fields DEFAULT_SETTINGS had in
  family-board.jsx:72-93, with values a real board would have drifted to, and
  no schemaVersion, because nothing stamped one. Every test about backward
  compatibility runs against this literal rather than against the current
  defaults, so it keeps testing the old shape even after the new one changes.
*/
const V0_SETTINGS = {
  theme: "mist",
  customPaper: "",
  dayStart: 6,
  dayEnd: 22,
  bedtime: "23:00",
  wakeTime: "07:15",
  sleepDim: 0.2,
  wakeTapSeconds: 120,
  screensaver: false,
  idleMinutes: 12,
  monthArt: false,
  photos: ["https://example.test/one.jpg"],
};

const V0_MEMBERS = [
  { id: "brian", name: "Brian", color: "#7EB6E8", photo: "" },
  { id: "rachel", name: "Rachel", color: "#F0A3B8", photo: "", onBoard: false },
];

describe("migrate — a version 0 board", () => {
  it("keeps every value the user had set", () => {
    const { settings } = migrate({ settings: V0_SETTINGS });

    for (const [key, value] of Object.entries(V0_SETTINGS)) {
      expect(settings[key], `settings.${key} was lost`).toEqual(value);
    }
  });

  it("fills the fields later waves need with inert defaults", () => {
    const { settings } = migrate({ settings: V0_SETTINGS });

    expect(settings.mode).toBe("personal");
    expect(settings.calendars).toEqual({ personal: [], roommate: [] });
    expect(settings.weather).toEqual({ label: "", lat: null, lon: null, units: "F" });
    expect(settings.drive).toEqual({ folderId: "" });
  });

  it("derives sleepStyle from the old slider position", () => {
    /* 0.2 is a deliberate dim. */
    expect(migrate({ settings: V0_SETTINGS }).settings.sleepStyle).toBe("dim");

    /*
      0 is not "no dimming" — SleepVeil floors its opacity at 0.02 so the clock
      stays readable, so a slider dragged to 0 was a user asking for black and
      getting as close as the prototype could go.
    */
    expect(migrate({ settings: { ...V0_SETTINGS, sleepDim: 0 } }).settings.sleepStyle).toBe(
      "black",
    );
  });

  it("does not re-derive sleepStyle once it is explicit", () => {
    const { settings } = migrate({
      schemaVersion: SCHEMA_VERSION,
      settings: { ...V0_SETTINGS, sleepDim: 0, sleepStyle: "dim" },
    });
    expect(settings.sleepStyle).toBe("dim");
  });

  it("reports the version it came from", () => {
    expect(migrate({ settings: V0_SETTINGS }).migratedFrom).toBe(0);
    expect(migrate({ schemaVersion: 1, settings: V0_SETTINGS }).migratedFrom).toBe(1);
    expect(migrate({ settings: V0_SETTINGS }).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("defaults members' onBoard and modes without touching an explicit false", () => {
    const members = migrateMembers(V0_MEMBERS);

    expect(members[0].onBoard).toBe(true);
    expect(members[1].onBoard).toBe(false);
    expect(members[0].modes).toEqual(["personal", "roommate"]);
  });
});

describe("migrate — a first run", () => {
  it("returns the defaults from nothing at all", () => {
    for (const input of [undefined, null, {}, "garbage", 7]) {
      const board = migrate(input);
      expect(board.settings).toEqual(DEFAULT_SETTINGS);
      expect(board.members).toHaveLength(5);
      expect(board.notes).toEqual([]);
      expect(board.events).toEqual([]);
    }
  });

  it("is idempotent — migrating its own output changes nothing", () => {
    const once = migrate({ settings: V0_SETTINGS, members: V0_MEMBERS });
    const twice = migrate(once);
    expect(twice.settings).toEqual(once.settings);
    expect(twice.members).toEqual(once.members);
  });
});

describe("migrateSettings — Defect #12, the latent Settings crash", () => {
  it("replaces a theme this build does not have", () => {
    /*
      Settings.jsx reads THEMES[settings.theme].paper with no fallback, so a
      stale theme name throws when the panel opens — the one panel you would
      fix the theme from. It cannot reach a component any more.
    */
    const settings = migrateSettings({ ...V0_SETTINGS, theme: "theme-from-a-later-build" });

    expect(THEMES[settings.theme]).toBeDefined();
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(() => THEMES[settings.theme].paper).not.toThrow();
  });

  it("keeps a theme that does exist", () => {
    for (const name of Object.keys(THEMES)) {
      expect(migrateSettings({ theme: name }).theme).toBe(name);
    }
  });
});

describe("migrateSettings — clamps and repairs", () => {
  it("repairs an inverted or empty hour window", () => {
    /* Day and Week divide the stage by (dayEnd - dayStart): equal is a
       division by zero, inverted is a negative height. */
    expect(migrateSettings({ dayStart: 20, dayEnd: 8 }).dayEnd).toBeGreaterThan(20);
    expect(migrateSettings({ dayStart: 9, dayEnd: 9 }).dayEnd).toBe(10);

    const late = migrateSettings({ dayStart: 23, dayEnd: 23 });
    expect(late.dayStart).toBeLessThan(late.dayEnd);
  });

  it("clamps hours into a real day", () => {
    expect(migrateSettings({ dayStart: -4, dayEnd: 99 }).dayStart).toBe(0);
    expect(migrateSettings({ dayStart: -4, dayEnd: 99 }).dayEnd).toBe(23);
  });

  it("clamps the veil opacity to the slider's range", () => {
    expect(migrateSettings({ sleepDim: 5 }).sleepDim).toBe(0.4);
    expect(migrateSettings({ sleepDim: -1 }).sleepDim).toBe(0);
  });

  it("refuses a wake window of zero seconds", () => {
    /* A tap that buys nothing means the veil never lifts and the board is
       unusable at night, with no way in to fix the setting. */
    expect(migrateSettings({ wakeTapSeconds: 0 }).wakeTapSeconds).toBeGreaterThan(0);
  });

  it("falls back on a malformed clock string", () => {
    expect(migrateSettings({ bedtime: "25:00" }).bedtime).toBe(DEFAULT_SETTINGS.bedtime);
    expect(migrateSettings({ bedtime: "22" }).bedtime).toBe(DEFAULT_SETTINGS.bedtime);
    expect(migrateSettings({ bedtime: "" }).bedtime).toBe(DEFAULT_SETTINGS.bedtime);
    expect(migrateSettings({ wakeTime: "6:05" }).wakeTime).toBe("06:05");
  });

  it("rejects an unknown mode and an unknown sleep style", () => {
    expect(migrateSettings({ mode: "office" }).mode).toBe("personal");
    expect(migrateSettings({ sleepStyle: "sepia" }).sleepStyle).toBe(DEFAULT_SETTINGS.sleepStyle);
  });

  it("keeps calendar links per mode and drops the unusable ones", () => {
    const settings = migrateSettings({
      calendars: {
        personal: [
          { id: "brian@gmail.com", memberIds: ["brian"] },
          { id: "family@group.calendar.google.com", memberIds: ["brian", "rachel"], colorId: 4 },
          { memberIds: ["nobody"] },
        ],
        roommate: "not an array",
      },
    });

    expect(settings.calendars.personal).toEqual([
      { id: "brian@gmail.com", memberIds: ["brian"], enabled: true },
      {
        id: "family@group.calendar.google.com",
        memberIds: ["brian", "rachel"],
        colorId: 4,
        enabled: true,
      },
    ]);
    expect(settings.calendars.roommate).toEqual([]);
  });

  it("keeps an unknown field rather than stripping it", () => {
    /* A board briefly rolled back to an older build must not permanently
       discard the newer build's settings. */
    expect(migrateSettings({ ...V0_SETTINGS, fieldFromAFutureWave: 42 })).toMatchObject({
      fieldFromAFutureWave: 42,
    });
  });
});

describe("migrateEvents — the cache is not trusted", () => {
  it("revives ISO strings into live Dates", () => {
    /* This is the shape a pre-serializer cache would hold, and the shape a
       hand-edited blob holds. */
    const [event] = migrateEvents([
      {
        id: "e1",
        title: "Standup",
        start: "2026-09-09T13:00:00.000Z",
        end: "2026-09-09T14:00:00.000Z",
        memberIds: ["brian"],
      },
    ]);

    expect(event.start).toBeInstanceOf(Date);
    expect(event.end.getTime() - event.start.getTime()).toBe(3_600_000);
    /* Absent fields arrive filled, so a view never reads undefined. */
    expect(event).toMatchObject({ allDay: false, milestone: false, location: "", variant: 0 });
  });

  it("drops events that cannot be rendered or addressed", () => {
    const events = migrateEvents([
      { id: "", start: "2026-09-09T13:00:00Z", end: "2026-09-09T14:00:00Z" },
      { id: "bad-date", start: "the ides of March", end: "2026-09-09T14:00:00Z" },
      { id: "ok", start: "2026-09-09T13:00:00Z", end: "2026-09-09T14:00:00Z" },
      "not an object",
      null,
    ]);

    expect(events.map((e) => e.id)).toEqual(["ok"]);
  });

  it("returns an empty list for a missing or malformed slice", () => {
    expect(migrateEvents(undefined)).toEqual([]);
    expect(migrateEvents({ nope: true })).toEqual([]);
  });
});

describe("migrateNotes", () => {
  it("keeps a drawn note and drops an empty or keyless one", () => {
    const notes = migrateNotes([
      { key: "2026-09-09", strokes: [{ color: "#23262D", width: 3, pts: [[0.1, 0.2]] }] },
      { key: "2026-09-10", strokes: [] },
      { strokes: [{ color: "#23262D", width: 3, pts: [[0, 0]] }] },
    ]);

    expect(notes).toHaveLength(1);
    expect(notes[0].key).toBe("2026-09-09");
    expect(notes[0].strokes[0].pts).toEqual([[0.1, 0.2]]);
  });

  it("survives a stroke with a malformed point list", () => {
    const notes = migrateNotes([
      { key: "2026-09-09", strokes: [{ pts: [[0.5, 0.5], [0.6], "nope", null] }] },
    ]);
    expect(notes[0].strokes[0].pts).toEqual([[0.5, 0.5]]);
  });
});

describe("migrateMembers", () => {
  it("treats an empty or malformed roster as absent", () => {
    /* Every view keys off members and the footer filter row is the only way
       back to a person, so an empty roster is not a board. */
    expect(migrateMembers([])).toHaveLength(5);
    expect(migrateMembers("nope")).toHaveLength(5);
    expect(migrateMembers([{ name: "no id" }])).toHaveLength(5);
  });

  it("keeps a real roster and normalizes each member", () => {
    const members = migrateMembers([{ id: "sam", name: "Sam", modes: ["roommate", "roommate"] }]);
    expect(members).toEqual([
      { id: "sam", name: "Sam", color: "#9AA3AF", photo: "", onBoard: true, modes: ["roommate"] },
    ]);
  });
});
