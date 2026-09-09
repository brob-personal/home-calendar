import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, renderHook, act } from "@testing-library/react";

import { store } from "../lib/store.js";
import { startOfDay, addDays } from "../lib/date.js";
import { STORE_KEYS } from "./schema.js";
import { defineSource } from "./source.js";
import { useBoardData } from "../hooks/useBoardData.js";
import App from "../App.jsx";

/*
  ============================================================================
  PLAN.md §R3 acceptance: "An event persisted, reloaded, and rendered still has
  live Dates."
  ----------------------------------------------------------------------------
  Everything else in this wave is a unit test. This is the one that has to go
  end to end, because the landmine was never in any single function — it was in
  the seam between three of them: the source hands over live Dates, the store
  writes JSON, and the views call .getHours(). Each was individually correct
  and the composition lost the type.

  The scenario is the real one, not a contrived one: a wall board that has been
  running, is power-cycled, and comes back up before the network does. The
  source cannot answer, so the board paints its cache. Every test below stalls
  `list()` for exactly that reason — `() => new Promise(() => {})` is a dead
  network, and it is also the only way to observe the cache at all, since a
  live source correctly overwrites it the moment it answers.
  ============================================================================
*/

/* The source the mocked module hands out. Swapped between phases so a
   "reload" can meet a different network condition than the first boot did. */
let active;

vi.mock("../data/index.js", () => ({
  createSource: () => active,
}));

/** A source that never answers — a board with no network. */
function stalledSource() {
  return defineSource(
    {
      list: () => new Promise(() => {}),
      create: async (e) => e,
      update: async (_id, p) => p,
      remove: async () => {},
      subscribe: () => () => {},
    },
    "stalled source",
  );
}

/** A source whose list() rejects outright — a 401, a DNS failure, anything
    less disciplined than R8's google.js, which degrades internally instead
    of throwing. Deferred Defect #7's regression guard. */
function rejectingSource() {
  return defineSource(
    {
      list: () => Promise.reject(new Error("network down")),
      create: async (e) => e,
      update: async (_id, p) => p,
      remove: async () => {},
      subscribe: () => () => {},
    },
    "rejecting source",
  );
}

/** A source that answers, with nothing. The board is online and empty. */
function emptySource() {
  let events = [];
  const listeners = new Set();
  return defineSource(
    {
      list: async () => [...events],
      create: async (draft) => {
        const created = { ...draft, id: "created-1" };
        events = [...events, created];
        for (const fn of listeners) fn([...events]);
        return created;
      },
      update: async (id, patch) => ({ ...patch, id }),
      remove: async (id) => {
        events = events.filter((e) => e.id !== id);
      },
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    },
    "empty source",
  );
}

/* Today, so the Day view actually renders it, and inside the default
   dayStart/dayEnd window of 7-21. */
function todayAt(hour, minute = 0) {
  const d = startOfDay(new Date());
  d.setHours(hour, minute, 0, 0);
  return d;
}

const CACHED_EVENT = {
  id: "cached-1",
  title: "Persisted rehearsal",
  start: todayAt(10),
  end: todayAt(11, 30),
  allDay: false,
  memberIds: ["brian"],
  variant: 3,
  milestone: false,
  location: "Studio",
};

beforeEach(() => {
  localStorage.clear();
  active = stalledSource();
});

afterEach(() => {
  localStorage.clear();
});

describe("an event survives a reload with live Dates", () => {
  it("comes back out of storage as a Date, not a string", async () => {
    await store.set(STORE_KEYS.events, [CACHED_EVENT]);

    const [event] = await store.get(STORE_KEYS.events);

    expect(event.start).toBeInstanceOf(Date);
    expect(event.end).toBeInstanceOf(Date);
    expect(event.start.getTime()).toBe(CACHED_EVENT.start.getTime());
    /* The two operations every view performs on these fields. */
    expect(event.start.getHours()).toBe(10);
    expect(event.end - event.start).toBe(90 * 60 * 1000);
  });

  it("reaches the board's state as a Date", async () => {
    await store.set(STORE_KEYS.events, [CACHED_EVENT]);

    const { result } = renderHook(() => useBoardData(new Date()));

    await waitFor(() => expect(result.current.events).toHaveLength(1));

    const [event] = result.current.events;
    expect(event.start).toBeInstanceOf(Date);
    expect(event.title).toBe("Persisted rehearsal");
    /* Loading is still in flight — the cache painted first, which is the
       second half of Defect #13: a cold board used to show nothing at all
       until source.list() resolved. */
    expect(result.current.loaded).toBe(false);
  });

  it("renders on the board", async () => {
    /*
      The criterion's last word. If `start` were a string, DayView's
      minutesInto() would call .getHours() on it and this render would throw
      rather than fail an assertion.
    */
    await store.set(STORE_KEYS.events, [CACHED_EVENT]);

    render(<App />);

    expect(await screen.findByText("Persisted rehearsal")).toBeInTheDocument();
  });

  it("revives an ISO string in a hand-edited or pre-serializer cache", async () => {
    /* Not written by this app: a blob edited by hand, or one left by a build
       that predates the serializer. migrate() coerces it rather than letting a
       string reach a view. */
    localStorage.setItem(
      "board:events",
      JSON.stringify({
        v: 1,
        at: new Date().toISOString(),
        data: [
          { ...CACHED_EVENT, start: todayAt(9).toISOString(), end: todayAt(10).toISOString() },
        ],
      }),
    );

    const { result } = renderHook(() => useBoardData(new Date()));
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    expect(result.current.events[0].start).toBeInstanceOf(Date);
    expect(result.current.events[0].start.getHours()).toBe(9);
  });
});

describe("loading state — Deferred Defect #14", () => {
  it("shows a loading message rather than an empty-state view on a cold, cacheless start", async () => {
    active = stalledSource();

    render(<App />);

    expect(await screen.findByText("Loading your board…")).toBeInTheDocument();
    expect(
      screen.queryByText("Everyone is hidden. Tap a face below to bring a calendar back."),
    ).not.toBeInTheDocument();
  });

  it("skips the loading message when a cache paints immediately", async () => {
    active = stalledSource();
    await store.set(STORE_KEYS.events, [CACHED_EVENT]);

    render(<App />);

    expect(await screen.findByText("Persisted rehearsal")).toBeInTheDocument();
    expect(screen.queryByText("Loading your board…")).not.toBeInTheDocument();
  });
});

describe("source.list() rejects — Deferred Defect #7", () => {
  it("keeps the cache on screen and marks the board degraded instead of throwing", async () => {
    active = rejectingSource();
    await store.set(STORE_KEYS.events, [CACHED_EVENT]);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useBoardData(new Date()));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].title).toBe("Persisted rehearsal");
    expect(result.current.degraded).toBe(true);

    errors.mockRestore();
  });

  it("renders the Offline chip instead of a blank board", async () => {
    active = rejectingSource();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<App />);

    expect(await screen.findByText("Offline")).toBeInTheDocument();

    errors.mockRestore();
  });
});

describe("the full cycle — create, persist, reload", () => {
  it("an event created on the board is there after a restart", async () => {
    /* Phase 1: the board is online. Create an event the way the composer
       does, and let the write-through effect persist it. */
    active = emptySource();

    const first = renderHook(() => useBoardData(new Date()));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));

    await act(async () => {
      await first.result.current.createEvent({
        title: "Dinner at the Kims'",
        start: todayAt(18, 30),
        end: todayAt(20),
        memberIds: ["brian", "rachel"],
        variant: 0,
        location: "Decatur",
      });
    });

    await waitFor(async () => {
      expect(await store.get(STORE_KEYS.events)).toHaveLength(1);
    });
    first.unmount();

    /* Phase 2: power-cycled, and the network is not back yet. */
    active = stalledSource();

    const second = renderHook(() => useBoardData(new Date()));
    await waitFor(() => expect(second.result.current.events).toHaveLength(1));

    const [event] = second.result.current.events;
    expect(event.title).toBe("Dinner at the Kims'");
    expect(event.start).toBeInstanceOf(Date);
    expect(event.start.getHours()).toBe(18);
    expect(event.start.getMinutes()).toBe(30);
    expect(event.memberIds).toEqual(["brian", "rachel"]);
    expect(event.location).toBe("Decatur");
  });

  it("does not duplicate an event when the source also announces it", async () => {
    /*
      The mock and R8's adapter both emit on mutation, so by the time
      `await source.create()` resolves the new event is already in state via
      the subscription. An unguarded optimistic append would put it there
      twice — visibly, as two identical blocks on the wall.
    */
    active = emptySource();

    const { result } = renderHook(() => useBoardData(new Date()));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.createEvent({
        title: "Standup",
        start: todayAt(9),
        end: todayAt(9, 30),
        memberIds: ["brian"],
      });
    });

    expect(result.current.events.filter((e) => e.title === "Standup")).toHaveLength(1);
  });
});

describe("settings and notes survive with them", () => {
  it("loads a full board back out of storage", async () => {
    await store.set(STORE_KEYS.settings, { theme: "sage", dayStart: 6, dayEnd: 22, sleepDim: 0.3 });
    await store.set(STORE_KEYS.members, [
      { id: "sam", name: "Sam", color: "#7EB6E8", photo: "", onBoard: true },
    ]);
    await store.set(STORE_KEYS.notes, [
      { key: "2026-09-09", strokes: [{ color: "#23262D", width: 3, pts: [[0.5, 0.5]] }] },
    ]);

    const { result } = renderHook(() => useBoardData(new Date()));
    await waitFor(() => expect(result.current.members).toHaveLength(1));

    expect(result.current.settings.theme).toBe("sage");
    expect(result.current.settings.dayStart).toBe(6);
    /* Filled by the migration, not by the blob. */
    expect(result.current.settings.mode).toBe("personal");
    expect(result.current.settings.sleepStyle).toBe("dim");
    expect(result.current.members[0].name).toBe("Sam");
    expect(result.current.notes[0].strokes[0].pts).toEqual([[0.5, 0.5]]);
  });

  it("surfaces a storage failure instead of forgetting quietly", async () => {
    /*
      The old store swallowed everything, so a board that had stopped
      remembering looked identical to one that was fine. R12's failure UI reads
      this field.
    */
    localStorage.setItem("board:settings", "{ corrupt");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useBoardData(new Date()));
    await waitFor(() => expect(result.current.storageError).not.toBeNull());

    expect(result.current.storageError).toMatchObject({ code: "corrupt", key: "settings" });
    /* And the rest of the board still loaded. */
    expect(result.current.members).toHaveLength(5);
    expect(result.current.settings.theme).toBe("paper");

    errors.mockRestore();
  });

  it("keeps a milestone's all-day Dates through the round-trip", async () => {
    /* The countdown ticker sorts on `start` and subtracts dates. A string
       sorts lexicographically and looks almost right, which is worse. */
    const kauai = {
      id: "m1",
      title: "Kauai",
      start: addDays(startOfDay(new Date()), 41),
      end: addDays(startOfDay(new Date()), 49),
      allDay: true,
      milestone: true,
      memberIds: ["brian", "rachel"],
      variant: 0,
      location: "",
    };
    await store.set(STORE_KEYS.events, [kauai]);

    const [event] = await store.get(STORE_KEYS.events);

    expect(event.start).toBeInstanceOf(Date);
    expect(event.allDay).toBe(true);
    expect(Math.round((event.end - event.start) / 86_400_000)).toBe(8);
  });
});
