import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { store, StorageError, isAvailable, NAMESPACE } from "./store.js";
import { SCHEMA_VERSION } from "../contracts/schema.js";

/*
  PLAN.md §R3 item 3: "Swap store from window.storage to localStorage behind
  the same async interface. Both current bodies swallow errors silently —
  surface failures instead so a broken board is visible rather than
  mysteriously amnesiac."

  So there are two things to prove here, and the second matters more than the
  first: that values (including Dates) survive, and that every failure mode
  raises instead of returning quietly. The old implementation passed the first
  half of that vacuously — it returned null for everything.
*/

const KEY = "settings";

/*
  jsdom defines `localStorage` as an *own* property of the window, so a test
  that replaces it has to put the original descriptor back — deleting it would
  leave every later test in the file with no storage at all.
*/
const REAL_LOCAL_STORAGE = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function restoreLocalStorage() {
  if (REAL_LOCAL_STORAGE) Object.defineProperty(globalThis, "localStorage", REAL_LOCAL_STORAGE);
}

beforeEach(() => {
  restoreLocalStorage();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  restoreLocalStorage();
  localStorage.clear();
});

describe("store — round-trip", () => {
  it("returns null for a key that was never written", async () => {
    /* A first run. Distinct from a stored value that fails to parse, which
       throws — "nothing here" and "something broken here" are different
       situations and the board reacts differently to each. */
    await expect(store.get(KEY)).resolves.toBeNull();
    await expect(store.versionOf(KEY)).resolves.toBeNull();
  });

  it("reads back what it wrote", async () => {
    await store.set(KEY, { theme: "mist", dayStart: 7, photos: [] });
    await expect(store.get(KEY)).resolves.toEqual({ theme: "mist", dayStart: 7, photos: [] });
  });

  it("keeps Dates alive across the write", async () => {
    /* The acceptance criterion, at the storage layer. */
    const start = new Date("2026-09-09T18:30:00.000Z");
    await store.set("events", [{ id: "e1", start }]);

    const [event] = await store.get("events");
    expect(event.start).toBeInstanceOf(Date);
    expect(event.start.getTime()).toBe(start.getTime());
  });

  it("stamps every write with the schema version", async () => {
    await store.set(KEY, { theme: "paper" });

    expect(await store.versionOf(KEY)).toBe(SCHEMA_VERSION);

    const raw = JSON.parse(localStorage.getItem(NAMESPACE + KEY));
    expect(raw.v).toBe(SCHEMA_VERSION);
    expect(raw.data).toEqual({ theme: "paper" });
    /* `at` is for R14's recovery notes: when a board is stale, the first
       question is how stale. */
    expect(typeof raw.at).toBe("string");
  });

  it("namespaces its keys", async () => {
    /* localStorage is shared across the whole origin. A preview deployment
       alongside something else must not collide. */
    await store.set(KEY, 1);
    expect(localStorage.getItem(NAMESPACE + KEY)).not.toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("removes a slice", async () => {
    await store.set(KEY, { theme: "paper" });
    await store.remove(KEY);
    await expect(store.get(KEY)).resolves.toBeNull();
  });
});

describe("store — a pre-R3 blob", () => {
  it("reads an unwrapped value as version 0", async () => {
    /*
      What the artifact-era `window.storage` path wrote: the bare slice, with
      no envelope. migrate() keys its version steps off this, so reading it as
      0 is what makes "settings from before the migration load without loss"
      work.
    */
    localStorage.setItem(NAMESPACE + KEY, JSON.stringify({ theme: "cream", sleepDim: 0 }));

    await expect(store.get(KEY)).resolves.toEqual({ theme: "cream", sleepDim: 0 });
    await expect(store.versionOf(KEY)).resolves.toBe(0);
  });
});

describe("store — failures surface", () => {
  it("reports a corrupt blob instead of pretending the key is empty", async () => {
    localStorage.setItem(NAMESPACE + KEY, "{ half a writ");

    await expect(store.get(KEY)).rejects.toThrow(StorageError);
    await expect(store.get(KEY)).rejects.toMatchObject({ code: "corrupt", op: "get", key: KEY });
  });

  it("does not delete the corrupt blob it just refused to read", async () => {
    /* Self-healing here would turn a diagnosable corruption into an amnesiac
       board that looks fine — the exact failure this rewrite ends. */
    localStorage.setItem(NAMESPACE + KEY, "{ half a writ");
    await expect(store.get(KEY)).rejects.toThrow(StorageError);
    expect(localStorage.getItem(NAMESPACE + KEY)).toBe("{ half a writ");
  });

  it("reports a full quota as its own failure mode", async () => {
    /* The realistic failure on a board that runs for months: notes accumulate
       strokes and R9 will cache photo URLs. R12's UI wants to say "storage is
       full", not "storage failed". */
    const quota = Object.assign(new Error("exceeded"), { name: "QuotaExceededError" });
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw quota;
      },
      removeItem: () => {},
    });

    await expect(store.set(KEY, { theme: "paper" })).rejects.toMatchObject({
      code: "quota",
      op: "set",
      key: KEY,
      cause: quota,
    });
  });

  it("reports missing storage rather than silently running from memory", async () => {
    /* The old bodies called an API that exists in no browser and swallowed the
       result, so the board forgot everything on reload and never said so. */
    vi.stubGlobal("localStorage", undefined);

    expect(isAvailable()).toBe(false);
    await expect(store.get(KEY)).rejects.toMatchObject({ code: "unavailable" });
    await expect(store.set(KEY, 1)).rejects.toMatchObject({ code: "unavailable" });
    await expect(store.remove(KEY)).rejects.toMatchObject({ code: "unavailable" });
  });

  it("survives a localStorage that throws on property access", async () => {
    /* Safari with cookies fully blocked raises on the lookup, not on use. */
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });

    expect(isAvailable()).toBe(false);
    await expect(store.get(KEY)).rejects.toMatchObject({ code: "unavailable" });
    /* afterEach puts the real one back. */
  });

  it("reports a value it cannot serialize as a caller bug", async () => {
    const cyclic = {};
    cyclic.self = cyclic;
    await expect(store.set(KEY, cyclic)).rejects.toMatchObject({ code: "io", op: "set" });
  });
});
