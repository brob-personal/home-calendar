/*
  Note constants, moved verbatim from family-board.jsx:1084-1086.

  NOTE_W / NOTE_H are the note window's drawing surface in canvas px. They are
  not just a size: NOTE_W is also the reference width that stroke thickness is
  scaled against in drawStrokes, so a 3px stroke drawn in the big window
  renders proportionally thinner in the 150px dock thumbnail instead of
  swamping it.

  PENS is the five-colour palette. `#E0574F` here is the same literal as
  ACCENT_NOW, which is reserved for the now-line "and nothing else" — a note
  drawn in red is a coincidence of value, not a shared token. Worth knowing
  before R5 collapses them.
*/
export const PENS = ["#23262D", "#E0574F", "#4F8FE0", "#3FA97A", "#D9A32B"];
export const NOTE_W = 430;
export const NOTE_H = 250;
