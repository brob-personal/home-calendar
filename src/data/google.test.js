import { describe, it, expect, vi, beforeEach } from "vitest";

import { createGoogleSource } from "./google.js";
import { STORE_KEYS } from "../contracts/schema.js";
import { DEFAULT_SETTINGS } from "../contracts/defaults.js";
import { store } from "../lib/store.js";

/*
  source.contract.test.js proves google.js satisfies CalendarSource. These
  tests cover the behaviour that contract is deliberately silent on, and that
  PLAN.md §R8 calls out by name: the colorId <-> variant mapping (item 2), the
  sync-token lifecycle including a stale token (item 4), and degrading to a
  cached reading instead of an error on a dead network (item 5).
*/

const API_BASE = "https://fake-board.example";
const SECRET = "test-secret";
const CAL = "brian@example.com";

async function seedSettings(calendars) {
  await store.set(STORE_KEYS.settings, {
    ...DEFAULT_SETTINGS,
    mode: "personal",
    calendars: { personal: calendars, roommate: [] },
  });
}

function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("colour mapping", () => {
  it("folds Google's colorId into a variant within the owner's hue", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = new URL(url);
        expect(u.searchParams.get("calendarId")).toBe(CAL);
        return respond(200, {
          ok: true,
          items: [
            {
              id: "evt-1",
              summary: "Dentist",
              colorId: "4", // -> variant (4-1) % 11 = 3
              start: { dateTime: "2026-09-09T15:00:00.000Z" },
              end: { dateTime: "2026-09-09T16:00:00.000Z" },
            },
          ],
          nextSyncToken: "tok",
        });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const [event] = await source.list();

    expect(event.variant).toBe(3);
    expect(event.memberIds).toEqual(["brian"]); // no override -> inherits the calendar's
  });

  it("prefers an event's own colorId over the calendar's", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true, colorId: 2 }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(200, {
          ok: true,
          items: [
            {
              id: "evt-1",
              summary: "Gym",
              colorId: "6",
              start: { dateTime: "2026-09-09T07:00:00.000Z" },
              end: { dateTime: "2026-09-09T08:00:00.000Z" },
            },
          ],
        }),
      ),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const [event] = await source.list();
    expect(event.variant).toBe(5); // (6-1) % 11
  });

  it("reads memberIds from extendedProperties when a single event overrides its calendar", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(200, {
          ok: true,
          items: [
            {
              id: "evt-1",
              summary: "Family dinner",
              start: { dateTime: "2026-09-09T18:00:00.000Z" },
              end: { dateTime: "2026-09-09T19:00:00.000Z" },
              extendedProperties: { private: { members: "brian,rachel", milestone: "1" } },
            },
          ],
        }),
      ),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const [event] = await source.list();
    expect(event.memberIds).toEqual(["brian", "rachel"]);
    expect(event.milestone).toBe(true);
  });
});

describe("calendar selection on create", () => {
  it("targets the calendar whose members match exactly", async () => {
    await seedSettings([
      { id: "brian@x.com", memberIds: ["brian"], enabled: true },
      { id: "family@x.com", memberIds: ["brian", "rachel"], enabled: true },
    ]);
    const posted = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        if (init?.method === "POST") {
          const body = JSON.parse(init.body);
          posted.push(body);
          return respond(200, { ok: true, item: { ...body.event, id: "evt-1", etag: '"e1"' } });
        }
        return respond(200, { ok: true, items: [] });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    await source.create({
      title: "Trivia",
      start: new Date("2026-09-09T19:00:00Z"),
      end: new Date("2026-09-09T21:00:00Z"),
      memberIds: ["brian", "rachel"],
    });

    expect(posted[0].calendarId).toBe("family@x.com");
  });

  it("falls back to a superset calendar when there is no exact match", async () => {
    await seedSettings([
      { id: "kids@x.com", memberIds: ["david", "john", "tatyana"], enabled: true },
    ]);
    const posted = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        if (init?.method === "POST") {
          const body = JSON.parse(init.body);
          posted.push(body);
          return respond(200, { ok: true, item: { ...body.event, id: "evt-1", etag: '"e1"' } });
        }
        return respond(200, { ok: true, items: [] });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    await source.create({
      title: "Piano",
      start: new Date("2026-09-09T16:00:00Z"),
      end: new Date("2026-09-09T17:00:00Z"),
      memberIds: ["david"],
    });

    expect(posted[0].calendarId).toBe("kids@x.com");
  });

  it("throws when no calendar is configured for the active mode", async () => {
    await seedSettings([]);
    vi.stubGlobal("fetch", vi.fn());
    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    await expect(source.create({ title: "x", memberIds: ["brian"] })).rejects.toThrow(
      /no enabled google calendar/i,
    );
  });
});

describe("incremental sync", () => {
  it("sends the persisted sync token instead of a time window on the next list()", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    const calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = new URL(url);
        calls.push(Object.fromEntries(u.searchParams));
        return respond(200, { ok: true, items: [], nextSyncToken: "tok-42" });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    await source.list(); // first call: no token yet, uses a time window
    await source.list(); // second call: should carry the token from the first

    expect(calls[0].syncToken).toBeUndefined();
    expect(calls[0].timeMin).toBeDefined();
    expect(calls[1].syncToken).toBe("tok-42");
    expect(calls[1].timeMin).toBeUndefined();
  });

  it("drops a stale token and retries with a time window on a 410", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    await store.set("googleSyncTokens", { [CAL]: "stale-token" });

    const calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = new URL(url);
        calls.push(Object.fromEntries(u.searchParams));
        if (u.searchParams.get("syncToken")) {
          return respond(410, {
            ok: false,
            error: "sync token invalid",
            code: "SYNC_TOKEN_INVALID",
          });
        }
        return respond(200, { ok: true, items: [], nextSyncToken: "fresh-token" });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const events = await source.list();

    expect(events).toEqual([]);
    expect(calls[0].syncToken).toBe("stale-token");
    expect(calls[1].timeMin).toBeDefined();

    const tokens = await store.get("googleSyncTokens");
    expect(tokens[CAL]).toBe("fresh-token");
  });
});

describe("degrading on failure", () => {
  it("falls back to the last successful merge within the session", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(200, {
          ok: true,
          items: [
            {
              id: "evt-1",
              summary: "Standup",
              start: { dateTime: "2026-09-09T09:00:00.000Z" },
              end: { dateTime: "2026-09-09T09:30:00.000Z" },
            },
          ],
          nextSyncToken: "tok",
        }),
      ),
    );
    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const good = await source.list();
    expect(good).toHaveLength(1);
    expect(good.degraded).toBeUndefined();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(500, { ok: false, error: "down" })),
    );
    const degraded = await source.list();

    expect(degraded).toHaveLength(1);
    expect(degraded[0].title).toBe("Standup");
    expect(degraded.degraded).toBe(true);
  });

  it("falls back to the persisted events cache on a cold start with no network", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    await store.set(STORE_KEYS.events, [
      {
        id: "cached-1",
        title: "Cached lunch",
        start: new Date("2026-09-09T12:00:00Z"),
        end: new Date("2026-09-09T13:00:00Z"),
        allDay: false,
        memberIds: ["brian"],
        variant: 0,
        milestone: false,
        location: "",
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(500, { ok: false, error: "down" })),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const events = await source.list();

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Cached lunch");
    expect(events.degraded).toBe(true);
  });

  it("resolves an empty list rather than throwing when nothing has ever synced", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(500, { ok: false, error: "down" })),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    await expect(source.list()).resolves.toEqual(expect.any(Array));
  });
});

describe("write-back", () => {
  it("round-trips memberIds and milestone through extendedProperties.private", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    let posted;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        if (init?.method === "POST") {
          posted = JSON.parse(init.body);
          return respond(200, { ok: true, item: { ...posted.event, id: "evt-1", etag: '"e1"' } });
        }
        return respond(200, { ok: true, items: [] });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const created = await source.create({
      title: "Kauai",
      start: new Date("2026-10-01T00:00:00Z"),
      end: new Date("2026-10-09T00:00:00Z"),
      allDay: true,
      memberIds: ["brian"],
      milestone: true,
      variant: 2,
    });

    expect(posted.event.extendedProperties.private.members).toBe("brian");
    expect(posted.event.extendedProperties.private.milestone).toBe("1");
    expect(posted.event.colorId).toBe("3"); // variant 2 -> colorId 3
    expect(posted.event.start).toEqual({ date: "2026-10-01" });
    expect(created.milestone).toBe(true);
    expect(created.allDay).toBe(true);
  });
});
