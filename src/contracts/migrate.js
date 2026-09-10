/*
  ============================================================================
  MIGRATION — R3, backlog item 6
  ----------------------------------------------------------------------------
  "Write migrate(persisted) handling absent fields and version bumps."

  Two different jobs, deliberately kept apart:

    1. VERSION STEPS (`MIGRATIONS`). One entry per schema break. Each `up()`
       receives the whole persisted bundle at version N-1 and returns it at
       version N. Steps run in order and only the ones newer than the stored
       version run at all. This is the part that will grow.

    2. NORMALIZATION. Runs unconditionally afterwards, on every load, at every
       version. It fills absent fields, clamps out-of-range numbers and coerces
       revived strings back to Dates. It is idempotent and total: feeding it
       its own output changes nothing, and no input makes it throw.

  Why both. A version step alone cannot protect the board, because the hazard
  is not only "an older shape" — it is also a blob edited by hand, a blob
  written by a build that shipped a field this one dropped, and a blob whose
  theme was renamed. Those have no version to key off. Normalization is what
  makes the board's read path total; the steps are what let a real rename
  happen later without losing data.

  DEFECT #12 IS FIXED HERE, and this is the natural place for it. Settings.jsx
  reads `THEMES[settings.theme].paper` with no `|| THEMES.paper` fallback, so a
  persisted blob naming a theme this build lacks — a rename, a downgrade, a
  partial migration — throws the moment Settings is opened, which is the one
  panel you would fix the bad theme from. Guarding the read in Settings.jsx
  would be R2's file to edit; guaranteeing the invariant is this file's job, so
  `theme` is validated against THEMES on every load and a stale name falls back
  to the default rather than reaching a component at all.
  ============================================================================
*/
import { THEMES } from "../lib/theme.js";

import {
  DEFAULT_BOARD,
  DEFAULT_DRIVE,
  DEFAULT_SETTINGS,
  DEFAULT_WEATHER,
  DEFAULT_CALENDARS,
} from "./defaults.js";
import {
  ACCESS_ROLES,
  MODES,
  SCHEMA_VERSION,
  SLEEP_STYLES,
  normalizeEvent,
  normalizeMember,
  normalizeNote,
  normalizeTask,
  normalizeRoutine,
} from "./schema.js";

/**
 * The persisted bundle, as assembled from the individual store keys. Every
 * slice is optional: `store.get` returns null for a key that was never
 * written, and a first run has none of them.
 *
 * @typedef {object} PersistedBoard
 * @property {number}   [schemaVersion]
 * @property {unknown}  [members]
 * @property {unknown}  [settings]
 * @property {unknown}  [notes]
 * @property {unknown}  [events]
 * @property {unknown}  [tasks]
 * @property {unknown}  [routines]
 */

/*
  ── Version steps ────────────────────────────────────────────────────────────

  Version 0 is the artifact era: blobs written through `window.storage` with no
  version stamp, holding the twelve original DEFAULT_SETTINGS fields, members
  without `modes`, and no events at all (they were never persisted — Defect
  #13).

  The 0 -> 1 step therefore adds fields rather than moving them, which is why
  its body is small: normalization below already fills anything absent. What
  the step does that normalization cannot is *derive* — read a user's old
  slider position and infer the discrete choice they were reaching for. That
  inference must happen exactly once, on the blob that predates the field, and
  never again once `sleepStyle` is explicit.
*/
export const MIGRATIONS = [
  {
    to: 1,
    /** @param {PersistedBoard} b @returns {PersistedBoard} */
    up(b) {
      const settings = isObject(b.settings) ? { ...b.settings } : {};

      /*
        SleepVeil renders at Math.max(opacity, 0.02) so the clock never fully
        vanishes, which means a slider dragged to 0 was already as dark as the
        prototype could go — that user was asking for "black". Anything above
        the floor was a deliberate dim.
      */
      if (settings.sleepStyle === undefined && settings.sleepDim !== undefined) {
        settings.sleepStyle = Number(settings.sleepDim) < 0.02 ? "black" : "dim";
      }

      return { ...b, settings };
    },
  },
];

/**
 * Bring a persisted bundle to the current schema and make every slice
 * contract-valid.
 *
 * Never throws. A bundle of nulls returns the defaults, which is the first-run
 * path; a bundle of garbage returns the defaults with whatever was salvageable
 * kept, which is the corrupt-blob path. The board renders either way.
 *
 * @param {PersistedBoard|null|undefined} persisted
 * @returns {{schemaVersion: number, members: import("./schema.js").Member[],
 *            settings: import("./schema.js").Settings,
 *            notes: import("./schema.js").Note[],
 *            events: import("./schema.js").Event[],
 *            tasks: import("./schema.js").Task[],
 *            routines: import("./schema.js").Routine[],
 *            migratedFrom: number}}
 */
export function migrate(persisted) {
  const input = isObject(persisted) ? persisted : {};

  /* An absent or unparseable stamp is version 0 — see the header. */
  const from = Number.isFinite(Number(input.schemaVersion)) ? Number(input.schemaVersion) : 0;

  let bundle = input;
  for (const step of MIGRATIONS) {
    if (step.to > from) bundle = step.up(bundle);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    /* Kept so R12's failure UI can say "restored from an older board" and so
       tests can assert a step actually ran rather than inferring it. */
    migratedFrom: from,
    members: migrateMembers(bundle.members),
    settings: migrateSettings(bundle.settings),
    notes: migrateNotes(bundle.notes),
    events: migrateEvents(bundle.events),
    tasks: migrateTasks(bundle.tasks),
    routines: migrateRoutines(bundle.routines),
  };
}

/* ============================================================================
   Per-slice normalization
   ========================================================================= */

/**
 * @param {unknown} raw
 * @returns {import("./schema.js").Member[]}
 */
export function migrateMembers(raw) {
  if (!Array.isArray(raw)) return DEFAULT_BOARD.members.map(normalizeMember);
  const members = raw
    .filter(isObject)
    .map(normalizeMember)
    .filter((m) => m.id);
  /*
    An empty roster is not a valid board: every view keys off members, the
    footer filter row would be empty, and there would be no way back to a
    person through the UI. Treat it as absent.
  */
  return members.length ? members : DEFAULT_BOARD.members.map(normalizeMember);
}

/**
 * Fill, clamp and validate the preference set.
 *
 * Unknown keys are preserved rather than stripped. That is what "settings from
 * before the migration load without loss" has to mean in both directions: a
 * board briefly rolled back to an older build must not silently discard the
 * newer build's fields, or rolling forward loses them permanently.
 *
 * @param {unknown} raw
 * @returns {import("./schema.js").Settings}
 */
export function migrateSettings(raw) {
  const s = isObject(raw) ? raw : {};

  return {
    /* Unknown keys first, so every field below wins over a stale copy. */
    ...s,
    ...DEFAULT_SETTINGS,
    ...pickKnown(s),

    /* Defect #12: a theme name this build does not have would throw in
       Settings.jsx. Validated here so it never reaches a component. */
    theme: typeof s.theme === "string" && THEMES[s.theme] ? s.theme : DEFAULT_SETTINGS.theme,
    customPaper: typeof s.customPaper === "string" ? s.customPaper : "",

    /*
      Hour bounds. Day and Week divide by (dayEnd - dayStart), so an inverted
      or equal pair is a division by zero or a negative height, not a cosmetic
      problem.
    */
    ...hourWindow(s),

    bedtime: clockOr(s.bedtime, DEFAULT_SETTINGS.bedtime),
    wakeTime: clockOr(s.wakeTime, DEFAULT_SETTINGS.wakeTime),

    sleepDim: clampNum(s.sleepDim, 0, 0.4, DEFAULT_SETTINGS.sleepDim),
    sleepStyle: SLEEP_STYLES.includes(s.sleepStyle) ? s.sleepStyle : DEFAULT_SETTINGS.sleepStyle,
    /* Zero would mean a tap buys nothing and the veil never lifts. */
    wakeTapSeconds: clampNum(s.wakeTapSeconds, 5, 3600, DEFAULT_SETTINGS.wakeTapSeconds),

    screensaver: bool(s.screensaver, DEFAULT_SETTINGS.screensaver),
    idleMinutes: clampNum(s.idleMinutes, 1, 240, DEFAULT_SETTINGS.idleMinutes),
    monthArt: bool(s.monthArt, DEFAULT_SETTINGS.monthArt),
    photos: Array.isArray(s.photos) ? s.photos.filter((p) => typeof p === "string") : [],

    mode: MODES.includes(s.mode) ? s.mode : DEFAULT_SETTINGS.mode,
    calendars: migrateCalendars(s.calendars),
    weather: { ...DEFAULT_WEATHER, ...pickWeather(s.weather) },
    drive: { ...DEFAULT_DRIVE, ...pickDrive(s.drive) },
  };
}

/**
 * @param {unknown} raw
 * @returns {import("./schema.js").Note[]}
 */
export function migrateNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return (
    raw
      .filter(isObject)
      .map(normalizeNote)
      /* A note with no key cannot be looked up by day, and one with no strokes
         is a deleted note — saveStrokes() drops those on write, so a blob
         holding one predates that rule or was edited by hand. */
      .filter((n) => n.key && n.strokes.length > 0)
  );
}

/**
 * The offline event cache. This slice did not exist before R3 — events were
 * never persisted, because JSON.stringify would have flattened their Dates
 * (Defect #13). Everything here comes back through normalizeEvent, so a
 * revived event is indistinguishable from one the source just handed over.
 *
 * @param {unknown} raw
 * @returns {import("./schema.js").Event[]}
 */
export function migrateEvents(raw) {
  if (!Array.isArray(raw)) return [];
  return (
    raw
      .filter(isObject)
      .map(normalizeEvent)
      /* An event with no id cannot be updated or removed, and an unparseable
       date renders as a block at an unknown time. Drop both rather than
       carrying them into a view. */
      .filter((e) => e.id && !Number.isNaN(e.start.getTime()) && !Number.isNaN(e.end.getTime()))
  );
}

/**
 * PLAN.md §R11 item 6: absent (never persisted) means first run, which is
 * exactly what warrants the seeded default list — same rule migrateMembers
 * applies to DEFAULT_MEMBERS. An empty array, unlike an empty members list,
 * is left alone: a roommate board that has completed and never re-added its
 * seeded chores is a normal state, not a corrupt one.
 *
 * @param {unknown} raw
 * @returns {import("./schema.js").Task[]}
 */
export function migrateTasks(raw) {
  if (!Array.isArray(raw)) return DEFAULT_BOARD.tasks.map(normalizeTask);
  return raw
    .filter(isObject)
    .map(normalizeTask)
    .filter((t) => t.id);
}

/**
 * @param {unknown} raw
 * @returns {import("./schema.js").Routine[]}
 */
export function migrateRoutines(raw) {
  if (!Array.isArray(raw)) return DEFAULT_BOARD.routines.map(normalizeRoutine);
  return raw
    .filter(isObject)
    .map(normalizeRoutine)
    .filter((r) => r.id);
}

/* ============================================================================
   Field helpers — small, boring, and the reason migrate() cannot throw
   ========================================================================= */

function isObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Only the keys DEFAULT_SETTINGS declares, and only when actually present. */
function pickKnown(s) {
  const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (s[k] !== undefined) out[k] = s[k];
  }
  return out;
}

function bool(v, fallback) {
  return typeof v === "boolean" ? v : fallback;
}

/*
  `Number(null)` is 0 and `Number("")` is 0, both finite — so a plain
  Number.isFinite guard silently turns "unset" into zero. That is how
  `weather.lat: null` became a real coordinate in the Gulf of Guinea, and how
  an absent `idleMinutes` would have become the clamp floor instead of the
  default. Absent is checked before numeric.
*/
function clampNum(v, min, max, fallback) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** "HH:MM" with real hours and minutes, or the fallback. */
function clockOr(v, fallback) {
  if (typeof v !== "string") return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return fallback;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/*
  dayStart and dayEnd are only meaningful as a pair: the views divide the stage
  by their difference. Clamp each into 0-23, then repair the relationship if
  the pair is still inverted or empty.
*/
function hourWindow(s) {
  const start = Math.trunc(clampNum(s.dayStart, 0, 23, DEFAULT_SETTINGS.dayStart));
  let end = Math.trunc(clampNum(s.dayEnd, 0, 23, DEFAULT_SETTINGS.dayEnd));
  if (end <= start) {
    end = start < 23 ? start + 1 : 23;
    return { dayStart: end === 23 && start === 23 ? 22 : start, dayEnd: end };
  }
  return { dayStart: start, dayEnd: end };
}

function migrateCalendars(raw) {
  const out = {};
  for (const mode of MODES) {
    const list = isObject(raw) && Array.isArray(raw[mode]) ? raw[mode] : DEFAULT_CALENDARS[mode];
    out[mode] = list
      .filter(isObject)
      .map((c) => ({
        id: String(c.id ?? ""),
        memberIds: Array.isArray(c.memberIds) ? c.memberIds.map(String) : [],
        ...(c.colorId === undefined ? {} : { colorId: Number(c.colorId) }),
        enabled: c.enabled === undefined ? true : Boolean(c.enabled),
        ...(ACCESS_ROLES.includes(c.accessRole) ? { accessRole: c.accessRole } : {}),
      }))
      .filter((c) => c.id);
  }
  return out;
}

function pickWeather(raw) {
  if (!isObject(raw)) return {};
  return {
    label: typeof raw.label === "string" ? raw.label : "",
    /* null is "not configured yet", and R6 shows nothing rather than guessing
       a city — so it must stay null and not clamp to 0. */
    lat: clampNum(raw.lat, -90, 90, null),
    lon: clampNum(raw.lon, -180, 180, null),
    units: raw.units === "C" ? "C" : "F",
  };
}

function pickDrive(raw) {
  if (!isObject(raw)) return {};
  return { folderId: typeof raw.folderId === "string" ? raw.folderId : "" };
}
