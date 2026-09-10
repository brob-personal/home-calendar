import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSource } from "./index.js";
import { createMockSource } from "./mock.js";
import { createGoogleSource } from "./google.js";
import { defineSource, inRange, SOURCE_METHODS } from "../contracts/source.js";
import { VARIATION_COUNT, STORE_KEYS } from "../contracts/schema.js";
import { DEFAULT_SETTINGS } from "../contracts/defaults.js";
import { store } from "../lib/store.js";

/*
  PLAN.md §R13 item 3: "Contract tests against R3's shapes so a wave cannot
  silently break a downstream consumer."

  This is that test for the source seam. Everything below is written against
  the *interface*, not against the mock — `runs` takes a factory, so when R8
  lands src/data/google.js it adds one line to the array at the bottom and
  inherits the whole suite. That is the point: R8's acceptance criteria talk
  about real calendars, and this is what stops a real calendar from arriving in
  a shape the views cannot render.
*/

const EVENT_FIELDS = [
  "id",
  "title",
  "start",
  "end",
  "allDay",
  "memberIds",
  "variant",
  "milestone",
  "location",
];

const DRAFT = {
  title: "Contract test",
  start: new Date("2026-09-09T10:00:00.000Z"),
  end: new Date("2026-09-09T11:00:00.000Z"),
  memberIds: ["brian", "rachel"],
  variant: 3,
};

/**
 * @param {string} name
 * @param {() => import("../contracts/source.js").CalendarSource} make
 * @param {{seed?: () => Promise<void>}} [opts] `seed` runs before every test —
 *   the google source needs Settings.calendars and a fake backend in place
 *   before `make()` is called, which the mock and createSource() variants do
 *   not.
 */
function runs(name, make, opts = {}) {
  describe(`${name} — source contract`, () => {
    beforeEach(async () => {
      if (opts.seed) await opts.seed();
    });

    it("implements all five methods", () => {
      const source = make();
      for (const method of SOURCE_METHODS) {
        expect(typeof source[method], `${name}.${method}`).toBe("function");
      }
    });

    it("lists contract-shaped events", async () => {
      const events = await make().list();

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);

      for (const e of events) {
        for (const field of EVENT_FIELDS) {
          expect(e, `event ${e.id} is missing ${field}`).toHaveProperty(field);
        }
        /* The whole reason the contracts exist: a string here breaks every
           minutesInto() and sameDay() downstream. */
        expect(e.start).toBeInstanceOf(Date);
        expect(e.end).toBeInstanceOf(Date);
        expect(Number.isNaN(e.start.getTime())).toBe(false);
        expect(e.end.getTime()).toBeGreaterThanOrEqual(e.start.getTime());
        expect(Array.isArray(e.memberIds)).toBe(true);
        /* variantColor() indexes VARIATIONS with this; out of range is a
           colour outside the pastel band. */
        expect(e.variant).toBeGreaterThanOrEqual(0);
        expect(e.variant).toBeLessThan(VARIATION_COUNT);
        expect(typeof e.title).toBe("string");
        expect(e.title.length).toBeGreaterThan(0);
      }
    });

    it("honours an optional range", async () => {
      const source = make();
      const all = await source.list();
      const sorted = [...all].sort((a, b) => a.start - b.start);
      const from = sorted[0].start;
      const to = new Date(from.getTime() + 36 * 60 * 60 * 1000);

      const window = await source.list({ from, to });

      expect(window.length).toBeGreaterThan(0);
      expect(window.length).toBeLessThanOrEqual(all.length);
      for (const e of window) {
        expect(inRange(e, { from, to })).toBe(true);
      }
    });

    it("assigns an id on create and resolves with the stored event", async () => {
      const source = make();
      const created = await source.create(DRAFT);

      expect(created.id).toBeTruthy();
      expect(created.title).toBe(DRAFT.title);
      expect(created.start).toBeInstanceOf(Date);
      /* The caller cannot know the id in advance, which is why it adds the
         returned event to state and never the draft. */
      expect(DRAFT).not.toHaveProperty("id");

      const listed = await source.list();
      expect(listed.find((e) => e.id === created.id)).toEqual(created);
    });

    it("patches on update and leaves the rest alone", async () => {
      const source = make();
      const created = await source.create(DRAFT);

      const updated = await source.update(created.id, { title: "Renamed" });

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe("Renamed");
      expect(updated.memberIds).toEqual(created.memberIds);
      expect(updated.start.getTime()).toBe(created.start.getTime());

      const listed = await source.list();
      expect(listed.filter((e) => e.id === created.id)).toHaveLength(1);
    });

    it("rejects an update to an unknown id", async () => {
      /* A silent no-op means an edit that appeared to work and did not. */
      await expect(make().update("no-such-event", { title: "x" })).rejects.toThrow();
    });

    it("will not let an update fork an event into two", async () => {
      const source = make();
      const created = await source.create(DRAFT);
      const before = (await source.list()).length;

      await source.update(created.id, { id: "a-different-id", title: "Renamed" });

      const listed = await source.list();
      expect(listed).toHaveLength(before);
      expect(listed.find((e) => e.id === created.id).title).toBe("Renamed");
      expect(listed.find((e) => e.id === "a-different-id")).toBeUndefined();
    });

    it("removes, and is idempotent about it", async () => {
      const source = make();
      const created = await source.create(DRAFT);

      await source.remove(created.id);
      expect((await source.list()).find((e) => e.id === created.id)).toBeUndefined();

      /* A wall board can double-fire a delete. The second must not raise. */
      await expect(source.remove(created.id)).resolves.toBeUndefined();
    });

    it("notifies subscribers after every mutation, with the current list", async () => {
      const source = make();
      const seen = vi.fn();
      const off = source.subscribe(seen);

      const created = await source.create(DRAFT);
      expect(seen).toHaveBeenCalledTimes(1);
      expect(seen.mock.lastCall[0].find((e) => e.id === created.id)).toEqual(created);

      await source.update(created.id, { title: "Renamed" });
      expect(seen).toHaveBeenCalledTimes(2);
      expect(seen.mock.lastCall[0].find((e) => e.id === created.id).title).toBe("Renamed");

      await source.remove(created.id);
      expect(seen).toHaveBeenCalledTimes(3);
      expect(seen.mock.lastCall[0].find((e) => e.id === created.id)).toBeUndefined();

      off();
      await source.create(DRAFT);
      expect(seen).toHaveBeenCalledTimes(3);

      /* Unsubscribing twice is safe — StrictMode will do it. */
      expect(() => off()).not.toThrow();
    });

    it("registers a listener once, however many times it is added", async () => {
      /* StrictMode double-invokes effects, so a subscribe/subscribe pair with
         one teardown between them is a real sequence, not a contrived one. */
      const source = make();
      const seen = vi.fn();
      source.subscribe(seen);
      source.subscribe(seen);

      await source.create(DRAFT);
      expect(seen).toHaveBeenCalledTimes(1);
    });

    it("does not hand out its internal array to mutate", async () => {
      const source = make();
      const first = await source.list();
      first.push({ id: "smuggled" });

      expect((await source.list()).find((e) => e.id === "smuggled")).toBeUndefined();
    });
  });
}

runs("mock", () => createMockSource());
runs("createSource()", () => createSource());

/*
  R8's google source, exercised against a fake backend rather than a real
  Google account. The fake speaks exactly the contract api/calendar/events.js
  and src/data/google.js agree on — one in-memory events map per calendarId —
  which is enough to prove google.js satisfies CalendarSource without needing
  network access or credentials in CI. api/calendar/events.js's own mapping
  onto the *real* Google API is reviewed, not covered here — see Deferred
  Defect #16.
*/
const FAKE_API_BASE = "https://fake-board.example";
const FAKE_SECRET = "test-device-secret";
const CALENDAR_A = "brian@example.com"; // memberIds: ["brian"]
const CALENDAR_B = "family@example.com"; // memberIds: ["brian", "rachel"]

function makeFakeGoogleBackend() {
  /** @type {Map<string, Map<string, object>>} */
  const calendars = new Map();
  let counter = 0;

  const calendarStore = (id) => {
    if (!calendars.has(id)) calendars.set(id, new Map());
    return calendars.get(id);
  };

  const respond = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  /** Seeds one event directly, bypassing HTTP — for fixture setup. */
  function seedEvent(calendarId, event) {
    const id = `evt-${++counter}`;
    calendarStore(calendarId).set(id, { ...event, id, etag: `"e${counter}"` });
    return id;
  }

  async function fetchImpl(input, init = {}) {
    const url = new URL(input instanceof URL ? input.toString() : input);
    if (url.pathname !== "/api/calendar/events")
      return respond(404, { ok: false, error: "not found" });

    const method = init.method || "GET";

    if (method === "GET") {
      const calendarId = url.searchParams.get("calendarId");
      const items = [...calendarStore(calendarId).values()];
      return respond(200, { ok: true, items, nextSyncToken: "fake-sync-token" });
    }

    if (method === "POST") {
      const { calendarId, event } = JSON.parse(init.body);
      const id = `evt-${++counter}`;
      const item = { ...event, id, etag: `"e${counter}"` };
      calendarStore(calendarId).set(id, item);
      return respond(200, { ok: true, item });
    }

    if (method === "PATCH") {
      const { calendarId, eventId, patch } = JSON.parse(init.body);
      const store = calendarStore(calendarId);
      const existing = store.get(eventId);
      if (!existing) return respond(404, { ok: false, error: "not found" });
      const item = {
        ...existing,
        ...patch,
        extendedProperties: {
          private: {
            ...existing.extendedProperties?.private,
            ...patch.extendedProperties?.private,
          },
        },
        id: eventId,
        etag: `"e${++counter}"`,
      };
      store.set(eventId, item);
      return respond(200, { ok: true, item });
    }

    if (method === "DELETE") {
      const calendarId = url.searchParams.get("calendarId");
      const eventId = url.searchParams.get("eventId");
      calendarStore(calendarId).delete(eventId);
      return respond(200, { ok: true });
    }

    return respond(405, { ok: false, error: "method not allowed" });
  }

  return { fetchImpl, seedEvent };
}

async function seedGoogleFixture() {
  localStorage.clear();
  await store.set(STORE_KEYS.settings, {
    ...DEFAULT_SETTINGS,
    mode: "personal",
    calendars: {
      personal: [
        { id: CALENDAR_A, memberIds: ["brian"], enabled: true, accessRole: "owner" },
        { id: CALENDAR_B, memberIds: ["brian", "rachel"], enabled: true },
      ],
      roommate: [],
    },
  });

  const backend = makeFakeGoogleBackend();
  vi.stubGlobal("fetch", vi.fn(backend.fetchImpl));

  /* At least one event must exist before any create() runs, so "lists
     contract-shaped events" (which calls list() first) has something. */
  backend.seedEvent(CALENDAR_A, {
    summary: "Seed event",
    start: { dateTime: new Date().toISOString() },
    end: { dateTime: new Date(Date.now() + 3600_000).toISOString() },
  });
}

runs("google", () => createGoogleSource({ apiBase: FAKE_API_BASE, deviceSecret: FAKE_SECRET }), {
  seed: seedGoogleFixture,
});

describe("defineSource", () => {
  it("names the methods a partial adapter is missing", () => {
    /* At construction, not at first use. A source missing `update` would
       otherwise fail weeks later, on a wall, with no console open. */
    expect(() => defineSource({ list: () => {}, create: () => {} }, "google source")).toThrow(
      /google source: missing required methods update, remove, subscribe/,
    );
  });

  it("rejects a non-object", () => {
    expect(() => defineSource(null)).toThrow(TypeError);
    expect(() => defineSource(() => {})).toThrow(TypeError);
  });

  it("returns a complete implementation unchanged", () => {
    const impl = Object.fromEntries(SOURCE_METHODS.map((m) => [m, () => {}]));
    expect(defineSource(impl)).toBe(impl);
  });
});

describe("inRange", () => {
  /* Minutes explicitly: Date.UTC truncates a fractional hour, so at(10.5)
     would silently be 10:00 and the overlap cases below would not test an
     overlap at all. */
  const at = (h, m = 0) => new Date(Date.UTC(2026, 8, 9, h, m));
  const event = { start: at(10), end: at(11) };

  it("is unbounded without a range", () => {
    expect(inRange(event)).toBe(true);
    expect(inRange(event, {})).toBe(true);
  });

  it("includes an overlap at either edge", () => {
    expect(inRange(event, { from: at(9), to: at(10, 30) })).toBe(true);
    expect(inRange(event, { from: at(10, 30), to: at(12) })).toBe(true);
    expect(inRange(event, { from: at(8), to: at(20) })).toBe(true);
  });

  it("excludes an event that starts exactly at the end bound", () => {
    /* Half-open, so a day and the next day do not both show the midnight
       event. */
    expect(inRange(event, { from: at(0), to: at(10) })).toBe(false);
  });

  it("excludes an event entirely outside", () => {
    expect(inRange(event, { from: at(12), to: at(14) })).toBe(false);
    expect(inRange(event, { from: at(0), to: at(9) })).toBe(false);
  });
});
