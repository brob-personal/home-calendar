import { describe, it, expect } from "vitest";

import { addDays } from "../../lib/date.js";
import { normalizeRoutine, normalizeTask } from "../../contracts/schema.js";
import {
  isActiveCycle,
  cycleIndex,
  assigneeForRoutine,
  routineTaskId,
  materializedTask,
  isCurrentInstance,
} from "./rotation.js";

/*
  PLAN.md §R11 acceptance: "A weekly rotation advances correctly across a
  simulated month." A month is four-to-five Sundays; the tests below walk
  every Sunday across two months (roughly nine weeks) and assert the
  rotation lands on the expected person each time, which is the simulation
  the acceptance line asks for.
*/

const ANCHOR = new Date("2026-01-04T00:00:00"); // a Sunday

function routine(overrides) {
  return normalizeRoutine({ id: "r1", title: "Vacuum", anchor: ANCHOR, ...overrides });
}

describe("assigneeForRoutine — fixed", () => {
  it("always answers the same person, every week", () => {
    const r = routine({ kind: "fixed", assigneeId: "brian" });
    for (let w = 0; w < 8; w++) {
      expect(assigneeForRoutine(r, addDays(ANCHOR, w * 7))).toBe("brian");
    }
  });
});

describe("assigneeForRoutine — rotating", () => {
  const group = ["brian", "rachel", "david", "john"];

  it("walks the group one step per cycle, wrapping, across a simulated two months", () => {
    const r = routine({ kind: "rotating", memberIds: group, everyN: 1 });
    const expected = [];
    for (let w = 0; w < 9; w++) expected.push(group[w % group.length]);

    const actual = Array.from({ length: 9 }, (_, w) =>
      assigneeForRoutine(r, addDays(ANCHOR, w * 7)),
    );
    expect(actual).toEqual(expected);
  });

  it("is deterministic — same routine and date always answers the same person", () => {
    const r = routine({ kind: "rotating", memberIds: group });
    const date = addDays(ANCHOR, 21);
    expect(assigneeForRoutine(r, date)).toBe(assigneeForRoutine(r, date));
  });

  it("advances only every everyN weeks", () => {
    const r = routine({ kind: "rotating", memberIds: group, everyN: 2 });
    // Weeks 0-1 -> cycle 0 -> brian; weeks 2-3 -> cycle 1 -> rachel; ...
    expect(assigneeForRoutine(r, addDays(ANCHOR, 0))).toBe("brian");
    expect(assigneeForRoutine(r, addDays(ANCHOR, 7))).toBe("brian");
    expect(assigneeForRoutine(r, addDays(ANCHOR, 14))).toBe("rachel");
    expect(assigneeForRoutine(r, addDays(ANCHOR, 21))).toBe("rachel");
    expect(assigneeForRoutine(r, addDays(ANCHOR, 28))).toBe("david");
  });

  it("has nobody to assign when the group is empty", () => {
    const r = routine({ kind: "rotating", memberIds: [] });
    expect(assigneeForRoutine(r, ANCHOR)).toBeNull();
  });

  it("is never active before its own anchor week", () => {
    const r = routine({ kind: "rotating", memberIds: group });
    expect(isActiveCycle(r, addDays(ANCHOR, -7))).toBe(false);
    expect(isActiveCycle(r, ANCHOR)).toBe(true);
  });

  it("stays on the same cycle for any day within its week, not just Sunday", () => {
    const r = routine({ kind: "rotating", memberIds: group });
    const wednesday = addDays(ANCHOR, 10); // second week, a Wednesday
    expect(assigneeForRoutine(r, wednesday)).toBe(group[1]);
    expect(cycleIndex(r, wednesday)).toBe(1);
  });
});

describe("routineTaskId / isCurrentInstance", () => {
  it("encodes the routine and week into a stable id", () => {
    expect(routineTaskId("r1", ANCHOR)).toBe("r1@2026-01-04");
    expect(routineTaskId("r1", addDays(ANCHOR, 3))).toBe("r1@2026-01-04");
    expect(routineTaskId("r1", addDays(ANCHOR, 7))).toBe("r1@2026-01-11");
  });

  it("a non-routine task is always current", () => {
    const t = normalizeTask({ id: "t1", routineId: null });
    expect(isCurrentInstance(t, ANCHOR)).toBe(true);
    expect(isCurrentInstance(t, addDays(ANCHOR, 30))).toBe(true);
  });

  it("a routine task is current only for the week it was materialized", () => {
    const r = routine({ kind: "fixed", assigneeId: "brian" });
    const task = normalizeTask(materializedTask(r, ANCHOR));
    expect(isCurrentInstance(task, ANCHOR)).toBe(true);
    expect(isCurrentInstance(task, addDays(ANCHOR, 3))).toBe(true);
    expect(isCurrentInstance(task, addDays(ANCHOR, 7))).toBe(false);
  });
});

describe("materializedTask", () => {
  it("builds a normalizable draft carrying the routine's assignment forward", () => {
    const r = routine({ kind: "fixed", assigneeId: "brian", title: "Trash", emoji: "🗑️" });
    const draft = materializedTask(r, ANCHOR);
    const task = normalizeTask(draft);
    expect(task).toMatchObject({
      id: "r1@2026-01-04",
      title: "Trash",
      emoji: "🗑️",
      assigneeId: "brian",
      done: false,
      routineId: "r1",
    });
  });
});
