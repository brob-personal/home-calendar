import { useState } from "react";

import { NoteThumb } from "./NoteThumb.jsx";
import { Plus } from "../shell/icons.jsx";

/*
  The always-present bubble, plus a peek at today's note. Moved verbatim from
  family-board.jsx:1120-1136, then folded in with the footer's old standalone
  "New event" button: one FAB now opens a two-option menu ("New sticky note",
  "New event") instead of jumping straight to the note window.

  `.fb-fab` at 56px is the only interactive element on the board that already
  clears Apple's 44pt minimum — every other target on R12's list is below it.
*/
export function NoteDock({ note, onOpenNote, onCompose, hidden }) {
  const [expanded, setExpanded] = useState(false);

  if (hidden) return null;

  const pick = (action) => {
    setExpanded(false);
    action();
  };

  return (
    <>
      {expanded && <div className="fb-fabscrim" onClick={() => setExpanded(false)} />}
      <div className="fb-dock">
        {!expanded && note?.strokes?.length > 0 && (
          <button className="fb-stickypeek" onClick={onOpenNote} aria-label="Open today's note">
            <NoteThumb strokes={note.strokes} w={150} h={87} />
          </button>
        )}
        {expanded && (
          <>
            <button className="fb-fabopt" onClick={() => pick(onOpenNote)}>
              New sticky note
            </button>
            <button className="fb-fabopt" onClick={() => pick(onCompose)}>
              New event
            </button>
          </>
        )}
        <button
          className={`fb-fab${expanded ? " is-open" : ""}`}
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Close menu" : "Add"}
          aria-expanded={expanded}
        >
          <Plus />
        </button>
      </div>
    </>
  );
}
