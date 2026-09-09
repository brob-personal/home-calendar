/*
  ============================================================================
  THE SOURCE INTERFACE — R3, backlog item 5
  ----------------------------------------------------------------------------
  "Formalize the source interface as list / create / update / remove /
  subscribe. Today `update` does not exist and there is no edit path in the
  whole app."

  The seam itself is the prototype's, and PLAN.md §5 rule 5 says to extend it
  rather than replace it: App calls createSource() once and never learns which
  implementation it got. What R3 adds is the other two methods and a definition
  strict enough that R8 cannot ship a partial adapter by accident.

  Why the two additions matter more than they look:

    `update` is the missing half of the app. Every existing mutation path is
    create-or-destroy — there is no edit anywhere, in any view. R7's event
    detail sheet is specified to have an edit action and REFACTOR-NOTES says
    plainly that it "will need R3's update". Defining it now means R7 and R8
    build against the same signature instead of meeting in the middle later.

    `subscribe` is what makes an always-on display correct rather than merely
    fresh. R8 polls with incremental sync tokens and refreshes on wake; without
    a push channel, every consumer would have to re-poll and diff for itself.
    One listener list, owned by the source, is the difference between a board
    that updates and a board that re-renders.

  This module is a contract, not an implementation: it declares the shape and
  checks it. It lives in contracts/ rather than data/ so that data/index.js and
  data/mock.js can both import it without a cycle, and so R8's google.js and
  R6's weather.js reach for the same definition.
  ============================================================================
*/

/**
 * Every method a calendar source must implement. Exported so a test can
 * enumerate them rather than restating the list — a contract test that hard-codes
 * the method names would pass while the contract drifted.
 */
export const SOURCE_METHODS = ["list", "create", "update", "remove", "subscribe"];

/**
 * A calendar source. Five methods, all of them required.
 *
 * @typedef {object} CalendarSource
 *
 * @property {(range?: {from?: Date, to?: Date}) => Promise<import("./schema.js").Event[]>} list
 *   All events, or those overlapping `range` when one is given. The range is
 *   optional and advisory: the mock filters in memory, R8 turns it into
 *   `timeMin`/`timeMax` so an always-on board is not refetching a decade of
 *   history on every poll. A source may return more than asked for; it may not
 *   return less. The array is the caller's — a source must not hand out a
 *   reference to its own state, or a caller's `.sort()` rewrites it.
 *
 * @property {(draft: Partial<import("./schema.js").Event>) => Promise<import("./schema.js").Event>} create
 *   Persist a new event and resolve with the stored version — including the id
 *   the source assigned, which the caller cannot know in advance. The caller
 *   adds the *returned* event to state, never the draft.
 *
 * @property {(id: string, patch: Partial<import("./schema.js").Event>) => Promise<import("./schema.js").Event>} update
 *   Merge `patch` into the stored event and resolve with the result. Rejects if
 *   `id` is unknown, because a silent no-op here means an edit that appeared to
 *   work and did not. `id` itself is not patchable.
 *
 * @property {(id: string) => Promise<void>} remove
 *   Delete an event. Idempotent: removing an id that is already gone resolves.
 *   Deletion is the one operation a wall board can trigger by accident, so the
 *   source must not turn a double-fire into an error the user has to see.
 *
 * @property {(listener: (events: import("./schema.js").Event[]) => void) => (() => void)} subscribe
 *   Register a listener called with the full event list after every change the
 *   source knows about — its own mutations, and for R8 also incremental sync
 *   results and wake refreshes. Returns its own unsubscribe function; calling
 *   that twice is safe. Listeners are notified after the change is durable, not
 *   before.
 */

/**
 * Validate an implementation against the interface and return it unchanged.
 *
 * Deliberately a throw, at construction, not a warning at first use. A source
 * missing `update` fails when someone edits an event — which on this board
 * means weeks after the adapter shipped, on a wall, with no console open. This
 * turns that into an immediate, obvious failure in dev and in the contract
 * tests.
 *
 * @template {Partial<CalendarSource>} T
 * @param {T} impl
 * @param {string} [name] Used in the error, so the message names the adapter.
 * @returns {CalendarSource}
 */
export function defineSource(impl, name = "source") {
  if (!impl || typeof impl !== "object") {
    throw new TypeError(`${name}: a calendar source must be an object.`);
  }
  const missing = SOURCE_METHODS.filter((m) => typeof impl[m] !== "function");
  if (missing.length) {
    throw new TypeError(
      `${name}: missing required method${missing.length > 1 ? "s" : ""} ${missing.join(", ")}. ` +
        `A calendar source implements ${SOURCE_METHODS.join(" / ")}.`,
    );
  }
  return impl;
}

/**
 * Does an event overlap a half-open range? The shared predicate behind
 * `list(range)`, so the mock and R8's cache filter identically.
 *
 * Half-open — start inclusive, end exclusive — because ranges are built from
 * day and week boundaries, and a closed range would show an event twice at
 * midnight. An absent bound is unbounded.
 *
 * @param {import("./schema.js").Event} e
 * @param {{from?: Date, to?: Date}} [range]
 * @returns {boolean}
 */
export function inRange(e, range) {
  if (!range) return true;
  const { from, to } = range;
  if (from instanceof Date && e.end.getTime() < from.getTime()) return false;
  if (to instanceof Date && e.start.getTime() >= to.getTime()) return false;
  return true;
}
