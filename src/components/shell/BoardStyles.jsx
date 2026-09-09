import { memo } from "react";

import { BOARD_CSS } from "../../styles/index.js";

/*
  Deferred Defect #8 — "<style> re-injected on every render",
  family-board.jsx:583 — is R2's one authorized fix, and this is it.

  The prototype rendered `<style>{CSS}</style>` inline in the root component's
  tree. The root re-renders on every clock tick (useNow's 20s interval), every
  filter tap, every settings keystroke and every pointer move while a note is
  being drawn, and each of those renders walked the 17KB stylesheet through
  reconciliation. On a board that stays up for months that is a real cost.

  Fixing it needs no new mechanism, only a boundary. BOARD_CSS is a module
  constant and this component takes no props, so memo() makes it render
  exactly once for the life of the mount and never again.

  It stays inside the React tree rather than moving to document.head on
  purpose: the sheet is scoped to the board, R1's smoke test asserts the
  canvas contract by reading the rendered <style> text, and an appended head
  node would leak across mounts in the test environment.
*/
export const BoardStyles = memo(function BoardStyles() {
  return <style>{BOARD_CSS}</style>;
});
