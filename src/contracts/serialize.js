/*
  ============================================================================
  THE DATE PROBLEM — R3, backlog item 2
  ----------------------------------------------------------------------------
  PLAN.md §1 calls this the "date landmine", and it is the prerequisite for
  the offline cache, for persistence, and for every sync path:

    Events carry live `Date` objects in `start` and `end`. JSON.stringify
    turns a Date into an ISO *string*. JSON.parse turns that string back into
    a string. Nothing in the app checks, so the first round-trip leaves
    `minutesInto(e.start)` calling `.getHours()` on a string and every view
    breaks at once.

  The fix is a tagged envelope rather than a list of date-shaped field names:

    new Date("2026-09-09T14:00:00Z")   ->   { "$date": "2026-09-09T14:00:00.000Z" }

  Why tagged and not field-based. The obvious alternative is a reviver that
  knows `start` and `end` are dates. That works exactly until a role adds a
  date somewhere else — and four of them do: `Task.doneAt`, `Routine.anchor`,
  `WeatherSnapshot.fetchedAt`, `sunrise`, `sunset`, `uvPeak.at`, and R8's sync
  timestamps. A field list would have to be edited by every one of those roles,
  in this file, which is exactly the cross-role coupling PLAN.md §5 rule 3
  exists to prevent. The tag travels with the value, so a new date anywhere in
  a new shape needs no change here.

  What is *not* handled, deliberately: Map, Set, RegExp, BigInt, undefined,
  functions, cyclic references. Nothing in the contracts uses them, JSON does
  not either, and inventing envelopes for shapes with no consumer is how a
  serializer becomes a liability. Adding one later is additive — a new tag —
  and does not invalidate anything already written.
  ============================================================================
*/

const DATE_TAG = "$date";

/*
  A Date whose time is NaN. `new Date(NaN).toISOString()` throws, so an invalid
  Date cannot be tagged with an ISO string; it is tagged with null instead and
  revived back to an invalid Date. That keeps the round-trip total: nothing
  throws on write, and what comes back is what went in.

  Invalid Dates reach here in practice — `new Date(g.start.dateTime)` on a
  malformed Google payload, or `at(off, h, m)` with a bad hour. The board would
  rather render one broken block than fail to persist the other forty.
*/
function tagDate(d) {
  const t = d.getTime();
  return { [DATE_TAG]: Number.isNaN(t) ? null : d.toISOString() };
}

/**
 * Is this the envelope this module writes?
 *
 * Strict on purpose: exactly one own key, that key is `$date`, and the value is
 * a string or null. A user object that merely happens to have a `$date`
 * property alongside anything else is left alone, which keeps the tag from
 * eating data it did not write.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
export function isDateTag(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (keys.length !== 1 || keys[0] !== DATE_TAG) return false;
  const inner = v[DATE_TAG];
  return inner === null || typeof inner === "string";
}

/**
 * The `JSON.stringify` replacer. Exported for callers that need to stringify
 * into someone else's envelope — R8 posting to Google, say — rather than
 * through toJSON() below.
 *
 * Subtlety worth knowing, because it is the one thing about this that is not
 * obvious: a replacer receives the value *after* the host object's own
 * `toJSON()` has run, and `Date.prototype.toJSON` returns a string. So by the
 * time a naive replacer sees `value`, the Date is already gone. `this` is the
 * holder object, so the pre-toJSON value is read back off it by key — which is
 * why this is a `function`, not an arrow.
 *
 * @this {object}
 * @param {string} key
 * @param {unknown} value
 * @returns {unknown}
 */
export function dateReplacer(key, value) {
  const raw = this && typeof this === "object" ? this[key] : value;
  return raw instanceof Date ? tagDate(raw) : value;
}

/**
 * The `JSON.parse` reviver. Turns every `{ $date }` envelope back into a live
 * Date, at any depth, in any shape.
 *
 * @param {string} _key
 * @param {unknown} value
 * @returns {unknown}
 */
export function dateReviver(_key, value) {
  if (!isDateTag(value)) return value;
  const iso = value[DATE_TAG];
  return iso === null ? new Date(NaN) : new Date(iso);
}

/**
 * Serialize any contract value to a string safe to persist.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function toJSON(value) {
  return JSON.stringify(value, dateReplacer);
}

/**
 * Parse a string written by toJSON back into live objects, Dates included.
 * Throws SyntaxError on malformed JSON — callers decide what a corrupt blob
 * means, because "there is nothing stored" and "what is stored is garbage" are
 * different situations and store.js reports them differently.
 *
 * @param {string} text
 * @returns {unknown}
 */
export function fromJSON(text) {
  return JSON.parse(text, dateReviver);
}

/**
 * Deep-clone through the serializer. The cheapest possible proof that a value
 * survives persistence: if `roundTrip(x)` differs from `x`, the board will
 * forget the difference on reload.
 *
 * Used by the contract tests, and by anything that wants a detached copy with
 * the same Date guarantees.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function roundTrip(value) {
  return fromJSON(toJSON(value));
}
