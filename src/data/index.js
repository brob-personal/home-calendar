/*
  The calendar source seam.
  >>> SWAP

  This is the single insertion point for real data. App.jsx calls
  createSource() once, in a useMemo, and never learns which implementation it
  got. PLAN.md §5 rule 5 names this seam as deliberate design to extend rather
  than replace.

  R3 formalized what passes through it (backlog item 5). The interface is now
  five methods — list / create / update / remove / subscribe — declared and
  enforced in ../contracts/source.js. `update` and `subscribe` are the two that
  did not exist; the reasoning for each is in that file, and the mock in
  ./mock.js is the reference implementation.

  R8 landed ./google.js behind this call — see that file for the calendar-to-
  member mapping, the colour mapping, write-back and sync. The choice below is
  the "one branch, on configuration" this comment used to promise: a deployed
  board has VITE_BOARD_DEVICE_SECRET baked into its bundle (it is the one
  secret .env.example marks client-visible, precisely so a check like this one
  can exist) and local/offline dev does not, so the mock stays the default the
  moment nothing is configured.
*/
import { createMockSource } from "./mock.js";
import { createGoogleSource } from "./google.js";

export { defineSource, inRange, SOURCE_METHODS } from "../contracts/source.js";

/**
 * The board's calendar source.
 *
 * @returns {import("../contracts/source.js").CalendarSource}
 */
export function createSource() {
  return import.meta.env.VITE_BOARD_DEVICE_SECRET ? createGoogleSource() : createMockSource();
}
