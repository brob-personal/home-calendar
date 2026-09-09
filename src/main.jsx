import React from "react";
import { createRoot } from "react-dom/client";

// R1 left this as the one line in the scaffold that knows where the board
// lives, to be repointed once the single file became src/components/**. R2's
// decomposition has landed, so it now points at the composed root. The
// prototype family-board.jsx is deleted (PLAN.md §R2 item 6).
import App from "./App.jsx";
import { ErrorBoundary } from "./components/shell/ErrorBoundary.jsx";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Family Board: no #root element in the document — check index.html.");
}

// StrictMode is on deliberately, and it is dev-only — it does not ship in the
// production build and changes nothing visually. It used to double-invoke
// Deferred Defect #1 (`onSave` called inside a `setStrokes` updater in
// NoteWindow.jsx) on every stroke; that's fixed now, so StrictMode stays on
// for the ordinary reason — it still catches other double-invocation bugs
// before they reach the wall.
//
// R12 item 4: a render error anywhere in the tree used to take the whole
// board down to a blank white screen with no recovery short of a reload a
// human has to notice is needed. ErrorBoundary is the outermost thing that
// can still render once App itself throws.
createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
