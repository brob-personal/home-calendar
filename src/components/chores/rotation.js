import { startOfWeek, dayKey } from "../../lib/date.js";

/*
  ============================================================================
  ROTATION — R11, PLAN.md §R11 item 7
  ----------------------------------------------------------------------------
  "Rotation state must be deterministic and testable." Every function here is
  pure: given a Routine and a Date, the answer is a function of `anchor`,
  `everyN` and (for a rotating routine) `memberIds` alone — never of anything
  accumulated in state. That is what lets a month be simulated in a test by
  just calling these with a week of dates in a loop, and what lets the
  materializer below be idempotent no matter how many times or in what order
  it runs.

  A "cycle" is `everyN` whole weeks, counted from the Sunday `startOfWeek`
  puts `anchor` on. Weeks are compared by their own start, not by raw
  millisecond distance, so a routine anchored on a Wednesday still rotates on
  a clean weekly boundary rather than one offset by that Wednesday.
  ============================================================================
*/

const MS_PER_WEEK = 7 * 86400000;

/** Whole weeks from the routine's anchor week to `date`'s week. Negative
 *  before the anchor. */
function weeksSinceAnchor(routine, date) {
  const anchorWeek = startOfWeek(routine.anchor).getTime();
  const dateWeek = startOfWeek(date).getTime();
  return Math.round((dateWeek - anchorWeek) / MS_PER_WEEK);
}

/**
 * Whether `date`'s week is a cycle boundary for this routine — the week a
 * chore is due at all. `everyN: 2` means every other week; a routine never
 * fires before its own anchor week.
 *
 * @param {import("../../contracts/schema.js").Routine} routine
 * @param {Date} date
 * @returns {boolean}
 */
export function isActiveCycle(routine, date) {
  const w = weeksSinceAnchor(routine, date);
  if (w < 0) return false;
  return w % Math.max(1, routine.everyN) === 0;
}

/**
 * Which cycle `date` falls in, counting from 0 at the anchor. Only
 * meaningful when `isActiveCycle` is true for the same pair; a non-boundary
 * week still returns the cycle it falls within, which `assigneeForRoutine`
 * relies on so "who's turn is it" stays sensible even off-boundary.
 *
 * @param {import("../../contracts/schema.js").Routine} routine
 * @param {Date} date
 * @returns {number}
 */
export function cycleIndex(routine, date) {
  const w = Math.max(0, weeksSinceAnchor(routine, date));
  return Math.floor(w / Math.max(1, routine.everyN));
}

/**
 * The member this routine points at for `date`'s cycle. `"fixed"` always
 * answers the same person; `"rotating"` walks `memberIds` one step per
 * cycle, wrapping. An empty rotation group has nobody to assign — null, not
 * a throw, same totality guarantee as the schema normalizers.
 *
 * @param {import("../../contracts/schema.js").Routine} routine
 * @param {Date} date
 * @returns {string|null}
 */
export function assigneeForRoutine(routine, date) {
  if (routine.kind === "fixed") return routine.assigneeId ?? null;
  const group = routine.memberIds || [];
  if (!group.length) return null;
  const idx = ((cycleIndex(routine, date) % group.length) + group.length) % group.length;
  return group[idx];
}

/**
 * The stable id a routine's chore instance gets for `date`'s week —
 * `${routineId}@${weekKey}`. Encoding the week in the id itself is what
 * makes "is this instance still current" a string comparison
 * (`isCurrentInstance` below) rather than a second piece of state to keep in
 * sync with `tasks`.
 *
 * @param {string} routineId
 * @param {Date} date
 * @returns {string}
 */
export function routineTaskId(routineId, date) {
  return `${routineId}@${dayKey(startOfWeek(date))}`;
}

/**
 * Build (but do not persist) this week's chore instance for a routine,
 * ready for `ensureRoutineTask`. Only meaningful to call when
 * `isActiveCycle(routine, date)` is true.
 *
 * @param {import("../../contracts/schema.js").Routine} routine
 * @param {Date} date
 * @returns {Partial<import("../../contracts/schema.js").Task>}
 */
export function materializedTask(routine, date) {
  return {
    id: routineTaskId(routine.id, date),
    title: routine.title,
    emoji: routine.emoji,
    assigneeId: assigneeForRoutine(routine, date),
    done: false,
    doneAt: null,
    order: 0,
    routineId: routine.id,
    mode: routine.mode,
  };
}

/**
 * Whether a persisted Task is still this week's instance of whatever
 * routine generated it. A non-routine task (`routineId: null`) is always
 * current — this only filters stale, previously-materialized weeks out of
 * the board, it never touches ad-hoc chores.
 *
 * @param {import("../../contracts/schema.js").Task} task
 * @param {Date} date
 * @returns {boolean}
 */
export function isCurrentInstance(task, date) {
  if (!task.routineId) return true;
  return task.id === routineTaskId(task.routineId, date);
}
