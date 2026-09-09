import { describe, it, expect } from "vitest";

import { normalizeTask, normalizeRoutine } from "./schema.js";
import { migrateTasks, migrateRoutines } from "./migrate.js";
import { DEFAULT_TASKS, DEFAULT_ROUTINES } from "./defaults.js";

/*
  R11's half of the contract R3 froze in schema.js: normalizeTask and
  normalizeRoutine are the runtime type system for Task/Routine, the same
  role normalizeEvent/normalizeMember play for their own shapes — kept in a
  new file rather than schema.test.js/migrate.test.js so this role's own test
  file, not R3's, carries the merge history for these two slices.
*/

describe("normalizeTask", () => {
  it("fills every contract field from a bare draft", () => {
    const t = normalizeTask({ id: "t1", title: "Dishes" });
    expect(t).toMatchObject({
      id: "t1",
      title: "Dishes",
      emoji: "",
      assigneeId: null,
      done: false,
      doneAt: null,
      order: 0,
      routineId: null,
      mode: "roommate",
    });
  });

  it("does not throw on anything", () => {
    for (const input of [undefined, null, {}, [], "text", 42, { doneAt: {} }]) {
      expect(() => normalizeTask(input)).not.toThrow();
    }
  });

  it("drops an unparseable doneAt rather than rendering Invalid Date", () => {
    const t = normalizeTask({ id: "t1", done: true, doneAt: "not-a-date" });
    expect(t.doneAt).toBeNull();
  });

  it("rejects a mode outside the closed union", () => {
    const t = normalizeTask({ id: "t1", mode: "vacation" });
    expect(t.mode).toBe("roommate");
  });
});

describe("normalizeRoutine", () => {
  it("fills every contract field from a bare draft", () => {
    const r = normalizeRoutine({ id: "r1", title: "Vacuum rotation", memberIds: ["a", "b"] });
    expect(r).toMatchObject({
      id: "r1",
      title: "Vacuum rotation",
      kind: "rotating",
      memberIds: ["a", "b"],
      cadence: "weekly",
      everyN: 1,
      mode: "roommate",
    });
    expect(r.anchor).toBeInstanceOf(Date);
  });

  it("does not throw on anything", () => {
    for (const input of [undefined, null, {}, [], "text", 42, { anchor: {} }]) {
      expect(() => normalizeRoutine(input)).not.toThrow();
    }
  });

  it("clamps everyN to at least 1", () => {
    expect(normalizeRoutine({ id: "r1", everyN: 0 }).everyN).toBe(1);
    expect(normalizeRoutine({ id: "r1", everyN: -3 }).everyN).toBe(1);
    expect(normalizeRoutine({ id: "r1", everyN: "2" }).everyN).toBe(2);
  });

  it("falls back to a valid anchor for an unparseable one", () => {
    const r = normalizeRoutine({ id: "r1", anchor: "not-a-date" });
    expect(Number.isNaN(r.anchor.getTime())).toBe(false);
  });
});

describe("migrateTasks", () => {
  it("seeds the default chore list on first use (absent key)", () => {
    const tasks = migrateTasks(undefined);
    expect(tasks.length).toBe(DEFAULT_TASKS.length);
    expect(tasks.every((t) => t.assigneeId === null)).toBe(true);
    expect(tasks.every((t) => t.mode === "roommate")).toBe(true);
  });

  it("leaves a genuinely empty list empty — completing every seed is not corruption", () => {
    expect(migrateTasks([])).toEqual([]);
  });

  it("drops entries with no id", () => {
    const tasks = migrateTasks([{ title: "no id" }, { id: "t1", title: "keep" }]);
    expect(tasks.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("migrateRoutines", () => {
  it("defaults to the empty list on first use", () => {
    expect(migrateRoutines(undefined)).toEqual(DEFAULT_ROUTINES);
  });

  it("normalizes a persisted routine", () => {
    const routines = migrateRoutines([
      { id: "r1", title: "Trash", kind: "fixed", assigneeId: "brian" },
    ]);
    expect(routines).toHaveLength(1);
    expect(routines[0]).toMatchObject({ id: "r1", kind: "fixed", assigneeId: "brian" });
  });
});
