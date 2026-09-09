/*
  ============================================================================
  DEFAULTS — R3, backlog item 4
  ----------------------------------------------------------------------------
  "Extend DEFAULT_SETTINGS with every field later waves need, defaulted and
  migrated."

  Every field a later role reads must exist here with a sane value *now*, for
  one reason: a role that ships its own default gets a different one from the
  role beside it, and the migration that reconciles them belongs to nobody. So
  R6's location, R9's folder id and R10's mode are all declared here, defaulted
  to inert, before any of those roles start.

  Nothing here is a feature. `weather.lat` being null means R6 has nowhere to
  fetch yet; `drive.folderId` being "" means R9's screensaver falls back to
  month art, which is what it already does. The board behaves exactly as it did
  before this file grew — verified by the smoke test — while the shape it
  persists is now the final one.

  The five original members are the family, which is Personal mode. They arrive
  in both modes (see `modes`) so the board still renders somebody in Roommate
  mode before R10 lands a roster editor; R10 narrows them.
  ============================================================================
*/
import { MODES } from "./schema.js";

/** @type {import("./schema.js").Member[]} */
export const DEFAULT_MEMBERS = [
  { id: "brian", name: "Brian", color: "#7EB6E8", photo: "", onBoard: true, modes: [...MODES] },
  { id: "rachel", name: "Rachel", color: "#F0A3B8", photo: "", onBoard: true, modes: [...MODES] },
  { id: "david", name: "David", color: "#8ED9B2", photo: "", onBoard: true, modes: [...MODES] },
  { id: "john", name: "John", color: "#F6C58A", photo: "", onBoard: true, modes: [...MODES] },
  { id: "tatyana", name: "Tatyana", color: "#C2A8E8", photo: "", onBoard: true, modes: [...MODES] },
];

/*
  Per-mode calendar sets, keyed by mode. R8 item 1 needs a
  calendar-id-to-memberIds map and R10 item 2 needs one such map per mode; this
  is both, and it is empty until R8 has real calendars to put in it. The
  CalendarLink shape itself is in ./schema.js with the rest of the contracts.
*/
/** @type {Record<string, import("./schema.js").CalendarLink[]>} */
export const DEFAULT_CALENDARS = {
  personal: [],
  roommate: [],
};

/*
  Weather. Keyless provider by R6's item 1, so there is no secret here — only a
  location and a unit. `lat`/`lon` null is the "not configured yet" state: R6
  shows nothing in the header rather than guessing a city.

  °F because SCOPING asks for °F. The `units` field exists so the choice is
  data rather than a hardcode, not because a second unit is planned.
*/
export const DEFAULT_WEATHER = {
  label: "",
  lat: null,
  lon: null,
  /** @type {"F"|"C"} */
  units: "F",
};

/*
  Drive photo screensaver. `folderId` is the one thing R9 needs from Settings —
  PLAN.md §R9 item 1 notes there is currently no UI at all to add photos. Empty
  means "no folder", which the existing Screensaver already handles by falling
  back to month art.
*/
export const DEFAULT_DRIVE = {
  folderId: "",
};

/** @type {import("./schema.js").Settings} */
export const DEFAULT_SETTINGS = {
  /* ── Unchanged from the prototype (family-board.jsx:72-93) ─────────────── */
  theme: "paper",
  customPaper: "",
  dayStart: 7,
  dayEnd: 21,
  bedtime: "22:00",
  wakeTime: "06:30",
  sleepDim: 0.05,
  wakeTapSeconds: 90,
  screensaver: true,
  idleMinutes: 6,
  monthArt: true,
  photos: [], // >>> SWAP: image URLs for the photo screensaver. R9 fills this from Drive.

  /* ── R3 additions ─────────────────────────────────────────────────────── */

  /*
    The discrete black-or-dim choice SCOPING asks for and the slider cannot
    express: SleepVeil floors its opacity at Math.max(opacity, 0.02) so the
    clock stays faintly visible, which means sleepDim: 0 is not black. "dim"
    preserves today's behaviour exactly; "black" is the new reachable state.

    `sleepDim` survives as the opacity used when sleepStyle is "dim", so no
    existing board changes appearance. The control for this is Settings.jsx,
    which R3 does not own — see Deferred Defect #16.
  */
  /** @type {"black"|"dim"} */
  sleepStyle: "dim",

  /* Active mode. Persisted here so it survives reload before R10's
     ModeContext exists; ModeContext reads and writes this field. */
  /** @type {"personal"|"roommate"} */
  mode: "personal",

  calendars: DEFAULT_CALENDARS,
  weather: DEFAULT_WEATHER,
  drive: DEFAULT_DRIVE,
};

/*
  The per-slice defaults migrate() falls back to. Kept as a single object so a
  new persisted slice is declared in exactly one place — R11 adds `tasks` and
  `routines` here when it lands them.
*/
export const DEFAULT_BOARD = {
  members: DEFAULT_MEMBERS,
  settings: DEFAULT_SETTINGS,
  /** @type {import("./schema.js").Note[]} */
  notes: [],
  /** @type {import("./schema.js").Event[]} */
  events: [],
};
