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

  The five original members are the family, which is Personal mode.

  R10 note: they used to arrive in both modes so the board rendered somebody
  in Roommate mode before a roster editor existed. That editor now exists
  (Settings' Family section — see Settings.jsx), so they are narrowed to
  `["personal"]` here, per SCOPING.txt's own framing: "you're essentially
  just toggling between whether you display the iPad publicly between
  roommates or if you move it into your room as a family calendar." The
  family and the roommates are two different sets of people, not the same
  five wearing a different hat. Roommate mode therefore starts with an empty
  roster by design — consistent with `weather.lat: null` and
  `drive.folderId: ""` below, "not configured yet" is a normal default on a
  board with no onboarding — and is populated by adding a person in Settings
  and ticking "Roommate".
  ============================================================================
*/

/** @type {import("./schema.js").Member[]} */
export const DEFAULT_MEMBERS = [
  { id: "brian", name: "Brian", color: "#7EB6E8", photo: "", photoDriveFolderId: "", onBoard: true, modes: ["personal"] },
  { id: "rachel", name: "Rachel", color: "#F0A3B8", photo: "", photoDriveFolderId: "", onBoard: true, modes: ["personal"] },
  { id: "david", name: "David", color: "#8ED9B2", photo: "", photoDriveFolderId: "", onBoard: true, modes: ["personal"] },
  { id: "john", name: "John", color: "#F6C58A", photo: "", photoDriveFolderId: "", onBoard: true, modes: ["personal"] },
  { id: "tatyana", name: "Tatyana", color: "#C2A8E8", photo: "", photoDriveFolderId: "", onBoard: true, modes: ["personal"] },
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
  PLAN.md §R11 item 6: "A seeded default chore list on first use." First use
  means the `tasks` key has never been written — migrateTasks() falls back to
  this exact list, the same "absent means these defaults" rule migrateMembers
  already applies to DEFAULT_MEMBERS. All start unassigned (`assigneeId:
  null`) in the chore bank, Roommate-mode only, per PLAN.md §R11's mandate.
*/
/** @type {import("./schema.js").Task[]} */
export const DEFAULT_TASKS = [
  { id: "chore-vacuum", title: "Vacuuming", emoji: "🧹" },
  { id: "chore-bathroom", title: "Clean bathroom", emoji: "🚽" },
  { id: "chore-trash", title: "Take out trash", emoji: "🗑️" },
  { id: "chore-dishes", title: "Dishes", emoji: "🍽️" },
  { id: "chore-counters", title: "Wipe counters", emoji: "🧽" },
  { id: "chore-laundry", title: "Laundry", emoji: "🧺" },
  { id: "chore-floors", title: "Sweep & mop floors", emoji: "🪣" },
  { id: "chore-tidy", title: "Tidy common areas", emoji: "🛋️" },
].map((t, i) => ({
  ...t,
  assigneeId: null,
  done: false,
  doneAt: null,
  order: i,
  routineId: null,
  mode: "roommate",
}));

/*
  No routine is a feature on its own — an empty rotation is a normal "not
  configured yet" default, the same shape as DEFAULT_CALENDARS. Authored from
  inside the chores tab itself (PLAN.md §R11 owns src/components/chores/**
  exclusively; there is no Settings section for this role to add one to).
*/
/** @type {import("./schema.js").Routine[]} */
export const DEFAULT_ROUTINES = [];

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
  tasks: DEFAULT_TASKS,
  routines: DEFAULT_ROUTINES,
};
