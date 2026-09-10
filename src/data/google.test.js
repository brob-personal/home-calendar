import { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { createGoogleSource, fetchAccessRole, useCalendarAccessSync } from "./google.js";
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

describe("per-member calendar writes on create", () => {
  function stubInserts() {
    const posted = [];
    let nextId = 1;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        if (init?.method === "POST") {
          const body = JSON.parse(init.body);
          posted.push(body);
          return respond(200, {
            ok: true,
            item: { ...body.event, id: `evt-${nextId++}`, etag: '"e1"' },
          });
        }
        return respond(200, { ok: true, items: [] });
      }),
    );
    return posted;
  }

  it("inserts once per selected member, into that member's own calendar", async () => {
    await seedSettings([
      { id: "brian@x.com", memberIds: ["brian"], enabled: true, accessRole: "writer" },
      { id: "rachel@x.com", memberIds: ["rachel"], enabled: true, accessRole: "owner" },
    ]);
    const posted = stubInserts();

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const created = await source.create({
      title: "Trivia",
      start: new Date("2026-09-09T19:00:00Z"),
      end: new Date("2026-09-09T21:00:00Z"),
      memberIds: ["brian", "rachel"],
    });

    expect(posted).toHaveLength(2);
    expect(posted.map((p) => p.calendarId).sort()).toEqual(["brian@x.com", "rachel@x.com"]);
    expect(posted.every((p) => p.event.summary === "Trivia")).toBe(true);
    expect(created.googleEventIds).toEqual({ brian: "evt-1", rachel: "evt-2" });
  });

  it("skips a read-only member and a member with no linked calendar, writing only for the writable one", async () => {
    await seedSettings([
      { id: "brian@x.com", memberIds: ["brian"], enabled: true, accessRole: "writer" },
      { id: "rachel@x.com", memberIds: ["rachel"], enabled: true, accessRole: "reader" },
    ]);
    const posted = stubInserts();

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const created = await source.create({
      title: "Piano",
      start: new Date("2026-09-09T16:00:00Z"),
      end: new Date("2026-09-09T17:00:00Z"),
      memberIds: ["brian", "rachel", "david"], // rachel: reader; david: no calendar at all
    });

    expect(posted).toHaveLength(1);
    expect(posted[0].calendarId).toBe("brian@x.com");
    expect(created.googleEventIds).toEqual({ brian: "evt-1" });
  });

  it("does not throw when no member has a writable calendar — it just writes nothing", async () => {
    await seedSettings([]);
    const posted = stubInserts();

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const created = await source.create({ title: "x", memberIds: ["brian"] });

    expect(posted).toHaveLength(0);
    expect(created.googleEventIds ?? {}).toEqual({});
  });

  it("keeps the other members' writes when one member's insert fails, and reports the failure", async () => {
    await seedSettings([
      { id: "brian@x.com", memberIds: ["brian"], enabled: true, accessRole: "writer" },
      { id: "rachel@x.com", memberIds: ["rachel"], enabled: true, accessRole: "writer" },
      { id: "david@x.com", memberIds: ["david"], enabled: true, accessRole: "owner" },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        if (init?.method === "POST") {
          const body = JSON.parse(init.body);
          if (body.calendarId === "rachel@x.com") {
            return respond(500, { ok: false, error: "Google is down" });
          }
          return respond(200, { ok: true, item: { ...body.event, id: `evt-${body.calendarId}` } });
        }
        return respond(200, { ok: true, items: [] });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const created = await source.create({
      title: "Family dinner",
      start: new Date("2026-09-09T18:00:00Z"),
      end: new Date("2026-09-09T19:00:00Z"),
      memberIds: ["brian", "rachel", "david"],
    });

    expect(created.googleEventIds).toEqual({
      brian: "evt-brian@x.com",
      david: "evt-david@x.com",
    });
    expect(created.writeErrors).toHaveLength(1);
    expect(created.writeErrors[0].memberId).toBe("rachel");
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

describe("incremental sync merges instead of replacing — R12's fix", () => {
  /*
    Regression guard for the bug R12 found and fixed while auditing for its
    own soak-test item: refreshAll() used to do `cache = merged` on every
    branch, so a sync-token poll that legitimately reported "nothing
    changed" (`items: []`) replaced the whole cache with an empty list —
    every previously-known, still-valid event vanished five minutes after
    the board first loaded.
  */
  it("keeps an unchanged event across a poll that reports no changes", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call++;
        if (call === 1) {
          return respond(200, {
            ok: true,
            nextSyncToken: "tok-1",
            items: [
              {
                id: "evt-1",
                summary: "Unchanged event",
                start: { dateTime: "2026-09-09T09:00:00.000Z" },
                end: { dateTime: "2026-09-09T10:00:00.000Z" },
              },
            ],
          });
        }
        return respond(200, { ok: true, nextSyncToken: "tok-2", items: [] });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    expect((await source.list()).map((e) => e.id)).toEqual(["evt-1"]);
    expect((await source.list()).map((e) => e.id)).toEqual(["evt-1"]);
  });

  it("still applies an update reported in a later delta", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call++;
        if (call === 1) {
          return respond(200, {
            ok: true,
            nextSyncToken: "tok-1",
            items: [
              {
                id: "evt-1",
                summary: "Original title",
                start: { dateTime: "2026-09-09T09:00:00.000Z" },
                end: { dateTime: "2026-09-09T10:00:00.000Z" },
              },
            ],
          });
        }
        return respond(200, {
          ok: true,
          nextSyncToken: "tok-2",
          items: [
            {
              id: "evt-1",
              summary: "Renamed",
              start: { dateTime: "2026-09-09T09:00:00.000Z" },
              end: { dateTime: "2026-09-09T10:00:00.000Z" },
            },
          ],
        });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    await source.list();
    const [event] = await source.list();
    expect(event.title).toBe("Renamed");
  });

  it("removes an event a later delta reports cancelled", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true }]);
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call++;
        if (call === 1) {
          return respond(200, {
            ok: true,
            nextSyncToken: "tok-1",
            items: [
              {
                id: "evt-1",
                summary: "Will be cancelled",
                start: { dateTime: "2026-09-09T09:00:00.000Z" },
                end: { dateTime: "2026-09-09T10:00:00.000Z" },
              },
            ],
          });
        }
        return respond(200, {
          ok: true,
          nextSyncToken: "tok-2",
          items: [{ id: "evt-1", status: "cancelled" }],
        });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    expect((await source.list()).map((e) => e.id)).toEqual(["evt-1"]);
    expect((await source.list()).map((e) => e.id)).toEqual([]);
  });

  it("doesn't let one calendar's empty delta erase another calendar's events", async () => {
    const CAL_B = "roommate@example.com";
    await seedSettings([
      { id: CAL, memberIds: ["brian"], enabled: true },
      { id: CAL_B, memberIds: ["rachel"], enabled: true },
    ]);
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        calls++;
        const u = new URL(url);
        const cal = u.searchParams.get("calendarId");
        const round = Math.ceil(calls / 2);
        if (round === 1) {
          return respond(200, {
            ok: true,
            nextSyncToken: `tok-${cal}-1`,
            items: [
              {
                id: `evt-${cal}`,
                summary: `Event on ${cal}`,
                start: { dateTime: "2026-09-09T09:00:00.000Z" },
                end: { dateTime: "2026-09-09T10:00:00.000Z" },
              },
            ],
          });
        }
        return respond(200, { ok: true, nextSyncToken: `tok-${cal}-2`, items: [] });
      }),
    );

    const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
    const first = (await source.list()).map((e) => e.id).sort();
    expect(first).toEqual([`evt-${CAL}`, `evt-${CAL_B}`].sort());

    const second = (await source.list()).map((e) => e.id).sort();
    expect(second).toEqual([`evt-${CAL}`, `evt-${CAL_B}`].sort());
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

describe("fetchAccessRole", () => {
  it("resolves the board account's accessRole for a calendar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        expect(new URL(url).pathname).toBe("/api/calendar/access");
        expect(new URL(url).searchParams.get("calendarId")).toBe("rachel@example.com");
        return respond(200, { ok: true, accessRole: "reader" });
      }),
    );

    const role = await fetchAccessRole({
      apiBase: API_BASE,
      deviceSecret: SECRET,
      calendarId: "rachel@example.com",
    });
    expect(role).toBe("reader");
  });

  it("resolves null rather than throwing on a network or server failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(500, { ok: false, error: "down" })),
    );

    const role = await fetchAccessRole({
      apiBase: API_BASE,
      deviceSecret: SECRET,
      calendarId: "rachel@example.com",
    });
    expect(role).toBeNull();
  });
});

describe("useCalendarAccessSync", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderWithSettings(initial) {
    return renderHook(
      ({ deviceSecret }) => {
        const [settings, setSettings] = useState(initial);
        useCalendarAccessSync(settings, setSettings, { apiBase: API_BASE, deviceSecret });
        return settings;
      },
      { initialProps: { deviceSecret: SECRET } },
    );
  }

  it("does nothing without a device secret — mock/dev mode has no real backend to ask", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderHook(
      ({ deviceSecret }) => {
        const [settings, setSettings] = useState({
          ...DEFAULT_SETTINGS,
          mode: "personal",
          calendars: { personal: [{ id: CAL, memberIds: ["brian"], enabled: true }], roommate: [] },
        });
        useCalendarAccessSync(settings, setSettings, { apiBase: API_BASE, deviceSecret });
        return settings;
      },
      { initialProps: { deviceSecret: "" } },
    );

    await act(async () => {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("checks every enabled calendar's accessRole and merges the result into settings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const calendarId = new URL(url).searchParams.get("calendarId");
        const accessRole = calendarId === "brian@x.com" ? "owner" : "reader";
        return respond(200, { ok: true, accessRole });
      }),
    );

    const { result } = renderWithSettings({
      ...DEFAULT_SETTINGS,
      mode: "personal",
      calendars: {
        personal: [
          { id: "brian@x.com", memberIds: ["brian"], enabled: true },
          { id: "rachel@x.com", memberIds: ["rachel"], enabled: true },
        ],
        roommate: [],
      },
    });

    await act(async () => {});

    expect(result.current.calendars.personal.find((c) => c.id === "brian@x.com").accessRole).toBe(
      "owner",
    );
    expect(result.current.calendars.personal.find((c) => c.id === "rachel@x.com").accessRole).toBe(
      "reader",
    );
  });

  it("re-checks on the same 5-minute cadence as the event poll", async () => {
    vi.useFakeTimers();
    let role = "writer";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(200, { ok: true, accessRole: role })),
    );

    const { result } = renderWithSettings({
      ...DEFAULT_SETTINGS,
      mode: "personal",
      calendars: { personal: [{ id: CAL, memberIds: ["brian"], enabled: true }], roommate: [] },
    });

    await act(async () => {});
    expect(result.current.calendars.personal[0].accessRole).toBe("writer");

    // Access revoked between checks — the next tick should pick it up.
    role = "reader";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(result.current.calendars.personal[0].accessRole).toBe("reader");
  });
});

describe("write-back", () => {
  it("round-trips milestone through extendedProperties.private on create, without claiming memberIds on the calendar", async () => {
    await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true, accessRole: "owner" }]);
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

    /* Not set: this calendar's own CalendarLink already carries exactly one
       owner, so the read path infers memberIds without extendedProperties
       saying so. */
    expect(posted.event.extendedProperties.private.members).toBeUndefined();
    expect(posted.event.extendedProperties.private.milestone).toBe("1");
    expect(posted.event.colorId).toBe("3"); // variant 2 -> colorId 3
    expect(posted.event.start).toEqual({ date: "2026-10-01" });
    expect(created.milestone).toBe(true);
    expect(created.allDay).toBe(true);
    expect(created.googleEventIds).toEqual({ brian: "evt-1" });
  });
});
