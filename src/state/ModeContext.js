import { createContext, useContext, useMemo, useCallback } from "react";

import { MODES } from "../contracts/schema.js";

/*
  ============================================================================
  MODE CONTEXT — R10
  ----------------------------------------------------------------------------
  PLAN.md §R10: "ModeContext holding the active mode; persisted." Roommate
  Mode and Personal Mode are two calendar sets, two rosters, one board — the
  active mode lives in `settings.mode` (R3), so switching is really just
  reading and writing that one field and re-deriving everything that depends
  on it.

  Three things are mode-derived and computed here, once, so nobody downstream
  reimplements the filter:

    - `roster`   — members.filter(m => m.modes.includes(mode)). The roommates
                   are not the family (SCOPING.txt), so a member belongs to
                   whichever mode(s) Settings assigns them to.
    - `calendars`— settings.calendars[mode], the CalendarLink[] R8's adapter
                   reads. Empty until R8 lands; the shape is already correct.
    - `views`    — PLAN.md §R10 item 5: "The only feature difference is the
                   To-do tab, which exists in Roommate mode only." Footer's
                   view switcher used to hardcode ["day","week","month",
                   "agenda"]; this is that list, mode-derived, with "todo"
                   appended in Roommate mode. R11 owns the tab's content —
                   this only makes it reachable.

  `useModeState` is the plain hook, not a context read. App.jsx already holds
  `members`/`settings`/`setSettings` directly (they are the return of
  useBoardData, not something App consumes through BoardContext), so it calls
  this the same way it calls useBoardPalette: a component cannot consume a
  context it is itself about to provide. `<ModeContext.Provider value={...}>`
  is rendered by App with that same result, exactly as BoardContext and
  PaletteContext take their value as a prop rather than reaching for state
  themselves — which is also why this file holds no components and is `.js`
  where PLAN.md §2 wrote `ModeContext.jsx`: the plan named the module, not
  the extension, and BoardContext.js took the same deviation for the same
  reason (react-refresh/only-export-components wants a component-only file).

  Everything else — Settings' mode toggle, R11's chores tab — is a plain
  descendant of wherever App renders the provider, so it reads and writes the
  active mode through `useMode()` instead of a prop thread three components
  deep.
  ============================================================================
*/

const BASE_VIEWS = ["day", "week", "month", "agenda"];

export const ModeContext = createContext(null);

/**
 * Read the mode bundle: `{ mode, setMode, roster, calendars, views,
 * isRoommate }`. Throws outside a provider for the same reason useBoard()
 * and usePalette() do — a silent `undefined` here would render whichever
 * mode happens to fall out of a missing check, not an obvious bug.
 */
export function useMode() {
  const value = useContext(ModeContext);
  if (!value) {
    throw new Error("useMode must be used inside a ModeContext provider.");
  }
  return value;
}

/**
 * @param {import("../contracts/schema.js").Member[]} members
 * @param {import("../contracts/schema.js").Settings} settings
 * @param {(updater: (s: import("../contracts/schema.js").Settings) => import("../contracts/schema.js").Settings) => void} setSettings
 */
export function useModeState(members, settings, setSettings) {
  /* settings.mode is already validated by migrate() on every load, but a
     caller can hand this hook a settings object that skipped migration (a
     test, mid-edit state) — falling back to MODES[0] keeps this hook total
     rather than trusting an upstream guarantee it cannot see. */
  const mode = MODES.includes(settings.mode) ? settings.mode : MODES[0];

  const setMode = useCallback(
    (next) => {
      if (!MODES.includes(next)) return;
      setSettings((s) => (s.mode === next ? s : { ...s, mode: next }));
    },
    [setSettings],
  );

  const roster = useMemo(
    () => members.filter((m) => m.modes.includes(mode)),
    [members, mode],
  );

  /* settings.calendars is guaranteed to have both keys by migrateCalendars —
     no `?? []` needed, but a bare index still reads as "the other mode's
     shape may not exist yet" to anyone skimming this file, so it stays
     explicit rather than assumed. Memoized so the `|| []` fallback doesn't
     hand out a fresh array identity on every render. */
  const calendars = useMemo(() => settings.calendars[mode] || [], [settings.calendars, mode]);

  const views = useMemo(
    () => (mode === "roommate" ? [...BASE_VIEWS, "todo"] : BASE_VIEWS),
    [mode],
  );

  return useMemo(
    () => ({ mode, setMode, roster, calendars, views, isRoommate: mode === "roommate" }),
    [mode, setMode, roster, calendars, views],
  );
}
