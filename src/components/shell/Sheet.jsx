import { Cross } from "./icons.jsx";

/*
  The modal shell shared by the composer and the settings panel. Moved
  verbatim from family-board.jsx:1678-1692.

  Unfixed and deliberately so — R12's backlog item 6 owns it: this closes on
  scrim click and on the X, and that is all. There is no focus trap, no
  Escape handler, and the stopPropagation on the inner div is the only thing
  keeping a tap inside the sheet from dismissing it.
*/
export function Sheet({ title, children, onClose, wide }) {
  return (
    <div className="fb-scrim" onClick={onClose}>
      <div className={`fb-sheet${wide ? " is-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="fb-sheethead">
          <h2>{title}</h2>
          <button className="fb-icon" onClick={onClose} aria-label="Close">
            <Cross />
          </button>
        </div>
        <div className="fb-sheetbody">{children}</div>
      </div>
    </div>
  );
}
