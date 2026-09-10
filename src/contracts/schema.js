/*
  ============================================================================
  THE CONTRACTS — R3, backlog item 1
  ----------------------------------------------------------------------------
  Every shape the board persists, syncs or renders is declared here, once. Six
  later roles read this file and none of them may redefine a field:

    R6  WeatherSnapshot            R10 Settings.mode / Settings.calendars
    R8  Event (Google write-back)  R11 Task / Routine
    R9  Settings.drive             R12 the failure states

  JSDoc typedefs are the type system (PLAN.md §R3: "JSDoc typedefs are
  sufficient"). There is no TypeScript in this project and adding it is not in
  any role's mandate, so the typedefs are enforced at runtime instead by the
  `normalize*` functions below and by the contract tests beside them.

  Two rules for anyone extending this file:

    1. Adding an optional field is a normal change. Renaming, removing or
       re-typing a field is a contract break: bump SCHEMA_VERSION, add a step
       to MIGRATIONS in ./migrate.js, and route the PLAN.md edit through R0
       *before* the code (PLAN.md §5 rule 2).
    2. Anything persisted must survive a JSON round-trip. Dates do not do that
       on their own — see ./serialize.js, which is why this file exists at all.
  ============================================================================
*/

/*
  The persisted-blob version. Every write goes out stamped with this number
  and every read is fed through migrate() to reach it.

  Version 0 is "no stamp at all": the artifact-era blobs written through
  `window.storage`, and anything written before this file landed. migrate()
  treats an absent version as 0, which is the case PLAN.md's acceptance
  criterion means by "settings from before the migration load without loss".
*/
export const SCHEMA_VERSION = 1;

/*
  The localStorage key set, under the `board:` namespace store.js applies.
  Declared here rather than spelled as literals at the call sites so that a
  slice cannot be persisted under two spellings — the failure mode where a
  board silently forgets one thing and remembers another.

  `events` is new: it is the offline cache Defect #13 blocked on, and it is
  writable only now that Dates survive serialization. `tasks` and `routines`
  are reserved for R11, which owns those slices; they are declared here so the
  key names are settled before two roles need them.
*/
export const STORE_KEYS = {
  members: "members",
  settings: "settings",
  notes: "notes",
  events: "events",
  tasks: "tasks",
  routines: "routines",
};

/* The two modes R10 switches between. The board is always in exactly one. */
export const MODES = ["personal", "roommate"];

/*
  The five weather icons, and only five. SCOPING.txt and PLAN.md §R6 item 2
  are explicit that every other condition maps to `sunny` — that is the spec,
  not a shortcut, so the union is closed here rather than left to R6.
*/
export const WEATHER_CONDITIONS = ["sunny", "partly", "cloudy", "rain", "snow"];

/*
  Sleep presentation. Today the only control is a 0-0.4 opacity slider
  (Settings.jsx), which cannot express "black" — 0 renders SleepVeil at
  Math.max(opacity, 0.02), never fully dark. The spec asks for a discrete
  choice, so `sleepStyle` is the choice and `sleepDim` becomes the opacity used
  when the choice is "dim".
*/
export const SLEEP_STYLES = ["black", "dim"];

/*
  Google numbers its event colours 1-11. `variant` is that number minus one,
  and variantColor() reads it as a shade *within* the owner's hue rather than a
  colour of its own. VARIATIONS.length in src/lib/color.js is the modulus; it
  is restated as a contract constant because R8 computes
  `(colorId - 1) % VARIATION_COUNT` before this app's colour code ever sees the
  event.
*/
export const VARIATION_COUNT = 11;

/*
  Google's own calendarList.get access levels, closed the same way
  ROUTINE_KINDS is: a hand-edited or stale value should degrade to "no known
  access" rather than be trusted as a role Google never granted.
*/
export const ACCESS_ROLES = ["owner", "writer", "reader", "freeBusyReader"];

/* ============================================================================
   Event
   ========================================================================= */
/**
 * A calendar event. The single shape shared by the mock source, the Google
 * adapter (R8) and all four views.
 *
 * @typedef {object} Event
 * @property {string}   id         Stable id. Google's event id once R8 lands.
 * @property {string}   title      Display text. Never empty — normalize fills "Untitled".
 * @property {Date}     start      Live Date. Serialized by ./serialize.js, never as a bare string.
 * @property {Date}     end        Live Date. For an all-day event this is the last day, inclusive.
 * @property {boolean}  allDay     True for date-only events; suppresses time rendering.
 * @property {string[]} memberIds  Owners. Two or more is what makes splitFill draw its diagonal band.
 * @property {number}   variant    0-10, a shade inside the owner's hue. `(colorId - 1) % 11`.
 * @property {boolean}  milestone  Feeds the countdown ticker.
 * @property {string}   location   Free text. "" when absent.
 * @property {string}   [calendarId] Source calendar. R8 sets it; the mock leaves it undefined.
 * @property {string}   [etag]     Google concurrency token, for R8's incremental sync.
 * @property {Record<string, string>} [googleEventIds] One entry per member calendar this
 *   event was written to on create — the write path's own event id, not a source
 *   calendar. Lets a future edit/delete find and update every copy instead of
 *   orphaning them. Absent for events that were never written by this app.
 */

/**
 * Coerce anything event-shaped into a contract-valid Event.
 *
 * Total by construction: it never throws and never returns a partial event, so
 * a malformed cache entry or a surprising Google payload degrades to a
 * renderable block instead of a crash in a view. `start`/`end` are run through
 * the Date coercion below, which is what makes a JSON-revived event
 * indistinguishable from a freshly-built one.
 *
 * @param {Partial<Event>} raw
 * @returns {Event}
 */
export function normalizeEvent(raw) {
  const e = raw || {};
  const start = asDate(e.start);
  const end = asDate(e.end);
  const out = {
    id: String(e.id ?? ""),
    title: typeof e.title === "string" && e.title.trim() ? e.title : "Untitled",
    start,
    /* An end before its start would render as a negative-height block. */
    end: end.getTime() < start.getTime() ? start : end,
    allDay: Boolean(e.allDay),
    memberIds: Array.isArray(e.memberIds) ? e.memberIds.map(String) : [],
    variant: clampVariant(e.variant),
    milestone: Boolean(e.milestone),
    location: typeof e.location === "string" ? e.location : "",
  };
  /* Optional fields stay absent rather than arriving as "" — R8 compares
     etags for its incremental sync and an empty string is not a missing one. */
  if (e.calendarId) out.calendarId = String(e.calendarId);
  if (e.etag) out.etag = String(e.etag);
  if (isPlainRecordOfStrings(e.googleEventIds)) out.googleEventIds = { ...e.googleEventIds };
  return out;
}

/* ============================================================================
   Member
   ========================================================================= */
/**
 * A person on the board. `color` is the hue every one of their events is a
 * shade of; nothing else in the app assigns colour.
 *
 * @typedef {object} Member
 * @property {string}   id       Referenced by Event.memberIds and Task.assigneeId.
 * @property {string}   name     Display name. `initialOf` derives the avatar letter.
 * @property {string}   color    Hex hue, e.g. "#7EB6E8".
 * @property {string}   photo    Avatar image URL. "" falls back to the initial.
 * @property {string}   photoDriveFolderId  Drive folder id whose first image, sorted
 *                                alphabetically by filename, becomes the avatar. Takes
 *                                priority over `photo` when both are set. "" falls back
 *                                to `photo`, then the initial.
 * @property {boolean}  onBoard  Whether the avatar appears in the footer filter row.
 * @property {string[]} modes    Modes this person belongs to. R10 narrows; default is both.
 */

/**
 * @param {Partial<Member>} raw
 * @returns {Member}
 */
export function normalizeMember(raw) {
  const m = raw || {};
  return {
    id: String(m.id ?? ""),
    name: typeof m.name === "string" ? m.name : "",
    color: typeof m.color === "string" && m.color ? m.color : "#9AA3AF",
    photo: typeof m.photo === "string" ? m.photo : "",
    photoDriveFolderId: typeof m.photoDriveFolderId === "string" ? m.photoDriveFolderId : "",
    /*
      `onBoard: true` when absent repeats the default the load effect already
      applied inline (`m.map(x => ({ onBoard: true, ...x }))`). It lives here
      now so every reader of a Member gets it, not just that one call site.
    */
    onBoard: m.onBoard === undefined ? true : Boolean(m.onBoard),
    modes: normalizeModes(m.modes),
  };
}

/* ============================================================================
   Note
   ========================================================================= */
/**
 * One day's sticky note. Strokes are normalized 0-1 so the same note renders
 * at any canvas size — PLAN.md §5 rule 5 names that as deliberate design.
 *
 * @typedef {object} Stroke
 * @property {string} color         Hex, from PENS.
 * @property {number} width         Thickness in NOTE_W-relative units.
 * @property {Array<[number, number]>} pts  Normalized 0-1 [x, y] pairs.
 *
 * @typedef {object} Note
 * @property {string}   key      Day key, "YYYY-MM-DD", from dayKey().
 * @property {Stroke[]} strokes  Empty means the note is deleted, not blank.
 */

/**
 * @param {Partial<Note>} raw
 * @returns {Note}
 */
export function normalizeNote(raw) {
  const n = raw || {};
  return {
    key: String(n.key ?? ""),
    strokes: (Array.isArray(n.strokes) ? n.strokes : [])
      .filter((s) => s && Array.isArray(s.pts))
      .map((s) => ({
        color: typeof s.color === "string" ? s.color : "#23262D",
        width: Number.isFinite(Number(s.width)) ? Number(s.width) : 3,
        pts: s.pts.filter((p) => Array.isArray(p) && p.length === 2).map((p) => [+p[0], +p[1]]),
      })),
  };
}

/* ============================================================================
   Task and Routine — R11's slices, shapes frozen here
   ========================================================================= */
/**
 * A chore. `order` is the manual sort inside a column; completed tasks sink to
 * the bottom of the screen, which is a render rule, not a reorder.
 *
 * @typedef {object} Task
 * @property {string}      id
 * @property {string}      title
 * @property {string}      emoji       "" when unset. SCOPING asks for emoji beside names.
 * @property {string|null} assigneeId  Member id, or null while it sits in the chore bank.
 * @property {boolean}     done
 * @property {Date|null}   doneAt      When it was completed; null while open.
 * @property {number}      order
 * @property {string|null} routineId   Set when a Routine generated this task.
 * @property {string}      mode        Which mode owns it. Chores are Roommate-mode only today.
 */

/**
 * A recurring chore rule. Two kinds, both from SCOPING: `fixed` is one person
 * every cycle; `rotating` walks `memberIds` one step per cycle ("one of these
 * four vacuums each week").
 *
 * Rotation must be deterministic and testable (PLAN.md §R11 item 7), which is
 * what `anchor` and `everyN` are for: the assignee for any cycle should be a
 * pure function of the rule and the date, never of accumulated state.
 *
 * @typedef {object} Routine
 * @property {string}      id
 * @property {string}      title
 * @property {string}      emoji
 * @property {"fixed"|"rotating"} kind
 * @property {string|null} assigneeId  The single owner when kind is "fixed".
 * @property {string[]}    memberIds   The rotation group when kind is "rotating".
 * @property {"weekly"}    cadence     Weekly is all SCOPING asks for; widening this is a contract change.
 * @property {number}      everyN      Cycle length in cadence units. 2 = every other week.
 * @property {Date}        anchor      Cycle-zero start. Rotation counts cycles from here.
 * @property {string}      mode
 */

/*
  The one cadence SCOPING asks for. A closed union of one still buys a
  validated field over a bare string — migrate() can reject a hand-edited
  "biweekly" the same way it rejects a stale theme name, and widening this
  later is the contract change PLAN.md §R11 item 7's own comment already
  calls out ("widening this is a contract change").
*/
export const ROUTINE_CADENCES = ["weekly"];
export const ROUTINE_KINDS = ["fixed", "rotating"];

/**
 * Coerce anything task-shaped into a contract-valid Task. Same totality
 * guarantee as normalizeEvent: a corrupt cache entry degrades to a
 * renderable chore rather than throwing inside a column.
 *
 * @param {Partial<Task>} raw
 * @returns {Task}
 */
export function normalizeTask(raw) {
  const t = raw || {};
  const doneAt = t.doneAt == null ? null : asDate(t.doneAt);
  return {
    id: String(t.id ?? ""),
    title: typeof t.title === "string" && t.title.trim() ? t.title : "Untitled chore",
    emoji: typeof t.emoji === "string" ? t.emoji : "",
    assigneeId: t.assigneeId == null ? null : String(t.assigneeId),
    done: Boolean(t.done),
    /* An Invalid Date here would render "Invalid Date" wherever completion
       time is shown; a done task with no valid doneAt reads as done anyway. */
    doneAt: doneAt && !Number.isNaN(doneAt.getTime()) ? doneAt : null,
    order: Number.isFinite(Number(t.order)) ? Number(t.order) : 0,
    routineId: t.routineId == null ? null : String(t.routineId),
    mode: MODES.includes(t.mode) ? t.mode : "roommate",
  };
}

/**
 * Coerce anything routine-shaped into a contract-valid Routine.
 *
 * `kind` decides which of `assigneeId`/`memberIds` actually drives rotation —
 * both are kept on every routine regardless of kind (rather than one being
 * absent) so switching kind in an editor never has to invent the other
 * field from nothing.
 *
 * @param {Partial<Routine>} raw
 * @returns {Routine}
 */
export function normalizeRoutine(raw) {
  const r = raw || {};
  const anchor = asDate(r.anchor);
  return {
    id: String(r.id ?? ""),
    title: typeof r.title === "string" && r.title.trim() ? r.title : "Untitled routine",
    emoji: typeof r.emoji === "string" ? r.emoji : "",
    kind: ROUTINE_KINDS.includes(r.kind) ? r.kind : "rotating",
    assigneeId: r.assigneeId == null ? null : String(r.assigneeId),
    memberIds: Array.isArray(r.memberIds) ? r.memberIds.map(String) : [],
    cadence: ROUTINE_CADENCES.includes(r.cadence) ? r.cadence : "weekly",
    /* Zero or negative would divide cycle math by nothing; every other week
       forward is the smallest meaningful step below "every week". */
    everyN: Math.max(1, Math.trunc(Number(r.everyN)) || 1),
    anchor: Number.isNaN(anchor.getTime()) ? new Date(0) : anchor,
    mode: MODES.includes(r.mode) ? r.mode : "roommate",
  };
}

/* ============================================================================
   WeatherSnapshot — R6's shape, frozen here
   ========================================================================= */
/**
 * One complete weather reading: everything the collapsed header chip and the
 * expanded widget need, in one cacheable object.
 *
 * `fetchedAt` is the whole point of the shape. A wall board with a dead
 * network must show stale weather rather than an error (PLAN.md §R6 item 5),
 * so the consumer needs to know the age of what it is showing.
 *
 * @typedef {object} WeatherHour
 * @property {Date}   at
 * @property {number} temp          °F or °C per Settings.weather.units.
 * @property {number} precipChance  0-100.
 *
 * One forecast day, today included. `daily[0]` is always the same day the
 * top-level `hi`/`lo`/`sunrise`/`sunset`/`uvPeak`/`hourly` fields describe —
 * those top-level fields exist so Day/Week and the header chip, which only
 * ever care about today, don't need to reach into `daily[0]` themselves.
 *
 * @typedef {object} WeatherDay
 * @property {Date}   date
 * @property {string} condition
 * @property {number} hi
 * @property {number} lo
 * @property {Date}   sunrise
 * @property {Date}   sunset
 * @property {{at: Date, index: number}|null} uvPeak
 * @property {WeatherHour[]} hourly
 *
 * @typedef {object} WeatherSnapshot
 * @property {Date}   fetchedAt
 * @property {{label: string, lat: number, lon: number}} location
 * @property {"F"|"C"} units
 * @property {number} temp          Current temperature.
 * @property {string} condition     One of WEATHER_CONDITIONS. Everything else maps to "sunny".
 * @property {number} hi
 * @property {number} lo
 * @property {Date}   sunrise
 * @property {Date}   sunset
 * @property {{at: Date, index: number}|null} uvPeak
 * @property {WeatherHour[]} hourly
 * @property {WeatherDay[]} daily     Today plus up to 15 more days, in order.
 */

/**
 * Fold any provider's condition string into the five icons the board has.
 * Unknown, absent and unmapped conditions all become "sunny" by spec.
 *
 * @param {string} condition
 * @returns {"sunny"|"partly"|"cloudy"|"rain"|"snow"}
 */
export function normalizeCondition(condition) {
  const c = String(condition || "").toLowerCase();
  return WEATHER_CONDITIONS.includes(c) ? c : "sunny";
}

/* ============================================================================
   Settings
   ========================================================================= */
/**
 * One Google calendar mapped to the people whose hue its events wear. Two or
 * more ids is what makes splitFill draw its diagonal band, so a shared family
 * calendar is expressed here rather than per-event.
 *
 * @typedef {object} CalendarLink
 * @property {string}   id         Google calendar id, usually an email address.
 * @property {string[]} memberIds  Owners of every event on this calendar.
 * @property {number}   [colorId]  Calendar-level Google colour, 1-11. Events with no
 *                                 colorId of their own inherit it (PLAN.md §R8 item 2).
 * @property {boolean}  enabled    Off keeps the mapping without syncing it.
 * @property {"owner"|"writer"|"reader"|"freeBusyReader"} [accessRole] The
 *   authenticated board account's access to this calendar, per Google's own
 *   calendarList.get. Absent until first fetched. Re-checked alongside the
 *   5-minute poll — access can be revoked by the calendar's owner at any
 *   time, so this is read-model metadata, not a one-time setup fact.
 */

/**
 * The whole persisted preference set. Defaults and per-field notes are in
 * ./defaults.js; this is the shape.
 *
 * @typedef {object} Settings
 * @property {string}  theme           A THEMES key. migrate() guarantees it names a theme that exists.
 * @property {string}  customPaper     Hex paper override. "" defers to the theme.
 * @property {number}  dayStart        First hour shown in Day/Week, 0-23.
 * @property {number}  dayEnd          Last hour shown, > dayStart.
 * @property {string}  bedtime         "HH:MM". Sleep mode starts here.
 * @property {string}  wakeTime        "HH:MM". Sleep mode ends here. May wrap midnight.
 * @property {number}  sleepDim        Veil opacity 0-0.4, used when sleepStyle is "dim".
 * @property {"black"|"dim"} sleepStyle  The discrete choice SCOPING asks for.
 * @property {number}  wakeTapSeconds  Seconds a tap buys before the veil returns.
 * @property {boolean} screensaver     Whether idle shows the screensaver at all.
 * @property {number}  idleMinutes     Inactivity before the screensaver appears.
 * @property {boolean} monthArt        Month artwork behind the board.
 * @property {string[]} photos         Screensaver image URLs. R9 fills these from Drive.
 * @property {"personal"|"roommate"} mode  Active mode. R10's ModeContext reads and writes it.
 * @property {Record<string, CalendarLink[]>} calendars  Per-mode calendar sets, keyed by mode.
 * @property {{label: string, lat: number|null, lon: number|null, units: "F"|"C"}} weather
 * @property {{folderId: string}} drive
 */

/* ============================================================================
   Shared coercions
   ========================================================================= */

/**
 * Anything date-ish to a live Date. Accepts a Date, an ISO string, an epoch
 * number, and the `{ $date }` envelope ./serialize.js writes — so a value that
 * skipped the reviver still lands as a Date rather than as a string that
 * silently breaks every minutesInto() downstream.
 *
 * Unparseable input yields an Invalid Date rather than throwing: a view that
 * renders one bad block is recoverable, a view that throws is not.
 *
 * @param {unknown} v
 * @returns {Date}
 */
export function asDate(v) {
  if (v instanceof Date) return v;
  if (v && typeof v === "object" && "$date" in v) return asDate(v.$date);
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") return new Date(v);
  return new Date(NaN);
}

/** @param {unknown} v @returns {boolean} A plain object whose values are all strings. */
function isPlainRecordOfStrings(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  return Object.values(v).every((x) => typeof x === "string");
}

/** @param {unknown} v @returns {number} 0-10, the shade index inside a hue. */
export function clampVariant(v) {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return 0;
  /* Positive modulus: Google colorIds arrive 1-11 and R8 subtracts one, but a
     hand-edited cache could hold anything. */
  return ((n % VARIATION_COUNT) + VARIATION_COUNT) % VARIATION_COUNT;
}

/** @param {unknown} v @returns {string[]} A valid, non-empty mode list. */
export function normalizeModes(v) {
  const list = (Array.isArray(v) ? v : []).map(String).filter((m) => MODES.includes(m));
  /* A member in no mode would be invisible in both, which is never what a
     malformed blob meant. Default to both and let R10 narrow. */
  return list.length ? [...new Set(list)] : [...MODES];
}
