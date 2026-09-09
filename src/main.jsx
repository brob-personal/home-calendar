import React from "react";
import { createRoot } from "react-dom/client";

// The untouched prototype. R2 replaces this import with ./App.jsx once the
// single file is decomposed into src/components/**; this is the only line in
// the scaffold that knows where the board lives.
import FamilyBoard from "../family-board.jsx";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Family Board: no #root element in the document — check index.html.");
}

// StrictMode is on deliberately, and it is dev-only — it does not ship in the
// production build and changes nothing visually.
//
// Be aware that it double-invokes effects and state updaters, which means it
// actively triggers Deferred Defect #1 (`onSave` called inside a `setStrokes`
// updater, family-board.jsx:1191 — a side effect in a reducer). That is the
// point: the plan already describes that defect in terms of StrictMode and
// assigns the fix to R12. Leaving StrictMode off would hide it until the board
// was on the wall.
createRoot(container).render(
  <React.StrictMode>
    <FamilyBoard />
  </React.StrictMode>,
);
