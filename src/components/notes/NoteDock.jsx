import { NoteThumb } from "./NoteThumb.jsx";
import { Pencil } from "../shell/icons.jsx";

/*
  The always-present bubble, plus a peek at today's note. Moved verbatim from
  family-board.jsx:1120-1136.

  `.fb-fab` at 56px is the only interactive element on the board that already
  clears Apple's 44pt minimum — every other target on R12's list is below it.
*/
export function NoteDock({ note, onOpen, hidden }) {
  if (hidden) return null;
  return (
    <div className="fb-dock">
      {note?.strokes?.length > 0 && (
        <button className="fb-stickypeek" onClick={onOpen} aria-label="Open today's note">
          <NoteThumb strokes={note.strokes} w={150} h={87} />
        </button>
      )}
      <button className="fb-fab" onClick={onOpen} aria-label="Write a note">
        <Pencil />
      </button>
    </div>
  );
}
