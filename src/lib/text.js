/*
  Moved verbatim from family-board.jsx:112-114. It sat in the prototype's
  "Utilities" block beside the colour helpers, but it is a name helper, not a
  colour one, so it lands in its own module rather than muddying color.js —
  whose export list PLAN.md §R2 item 1 names explicitly.
*/
export function initialOf(name) {
  return (
    String(name || "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}
