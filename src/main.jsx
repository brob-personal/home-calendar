import React from "react";
import { createRoot } from "react-dom/client";

// R1 left this as the one line in the scaffold that knows where the board
// lives, to be repointed once the single file became src/components/**. R2's
// decomposition has landed, so it now points at the composed root. The
// prototype family-board.jsx is deleted (PLAN.md §R2 item 6).
import App from "./App.jsx";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Family Board: no #root element in the document — check index.html.");
}

// StrictMode is on deliberately, and it is dev-only — it does not ship in the
// production build and changes nothing visually.
//
// Be aware that it double-invokes effects and state updaters, which means it
// actively triggers Deferred Defect #1 (`onSave` called inside a `setStrokes`
// updater — a side effect in a reducer, now at
// src/components/notes/NoteWindow.jsx). That is the point: the plan already
// describes that defect in terms of StrictMode and assigns the fix to R12.
// Leaving StrictMode off would hide it until the board was on the wall.
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
