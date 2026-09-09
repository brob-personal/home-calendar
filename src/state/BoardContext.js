import { createContext, useContext } from "react";

/*
  ============================================================================
  BOARD CONTEXT — R3
  ----------------------------------------------------------------------------
  PLAN.md §2 puts `BoardContext` in src/state/ beside `PaletteContext`, and
  R2's note in that file was written for this: "the provider takes its value as
  a prop rather than reaching for state itself, so R3 can wrap it without
  touching the colour logic."

  What travels through here is the whole board-data bundle useBoardData
  returns: members, settings, events, notes, the loaded flag, the storage
  error, and the mutators. Not because App needs it — App has the bundle in
  hand — but because three later roles do, from places props do not reach:

    R6  the weather section of Settings needs settings + setSettings
    R10 ModeContext reads and writes settings.mode, and swaps the roster
    R11 the chores tab needs members and the Task/Routine slices

  Without this, each of those threads a prop through Footer, Sheet and Settings
  to get at state that is already global in every meaningful sense — the same
  prop-drilling PaletteContext was introduced to stop, one wave later and three
  times over.

  Two structural notes, both inherited from PaletteContext deliberately:

    - The file exports no components. A module exporting both a component and
      a hook trips `react-refresh/only-export-components`, and App already
      renders `<PaletteContext.Provider>` inline — one less indirection for the
      same result. Hence `.js`, where PLAN.md §2 wrote `.jsx`; the plan named
      the module, not the extension.
    - The provider takes its value as a prop. The hook that produces that value
      stays in src/hooks/useBoardData.js, which keeps this file free of the
      persistence and effect ordering that hook is careful about.
  ============================================================================
*/

/** @type {import("react").Context<ReturnType<typeof import("../hooks/useBoardData.js").useBoardData>|null>} */
export const BoardContext = createContext(null);

/**
 * Read the board data bundle.
 *
 * Throws outside a provider rather than returning null. A consumer that
 * silently got `undefined` here would render an empty board — the exact
 * failure this project keeps having to diagnose — so the mistake is made loud
 * at the point it happens.
 *
 * @returns {ReturnType<typeof import("../hooks/useBoardData.js").useBoardData>}
 */
export function useBoard() {
  const value = useContext(BoardContext);
  if (!value) {
    throw new Error("useBoard must be used inside a BoardContext provider.");
  }
  return value;
}
