import { useEffect, useRef } from "react";

import { Cross } from "./icons.jsx";

/*
  The modal shell shared by the composer, the settings panel, and R7's event
  detail sheet. Moved verbatim from family-board.jsx:1678-1692.

  R12 item 6, fixed: this used to close on scrim click and the X only, with
  no focus trap and no Escape handler — the stopPropagation on the inner div
  was the only thing keeping a tap inside the sheet from dismissing it.

  The keydown listener lives on the sheet's own div, not `document` — every
  key inside the sheet bubbles to it naturally, so there's nothing to add or
  remove outside this component's own lifecycle. Escape always closes.
  Tab/Shift+Tab wrap at the first/last focusable descendant rather than
  escaping to whatever is behind the scrim, which on this board is either
  nothing (the sheet is the only thing rendered on top) or another sheet, and
  either way isn't where focus should go while this one is open.

  Focus moves onto the sheet's first focusable element (the header's own
  Close button, absent any other claim) on open, and back to whatever had it
  before on close, so tapping the settings gear and then closing the panel
  doesn't strand focus on a removed node. The composer's and detail sheet's
  `autoFocus` title inputs win over that default — React applies `autoFocus`
  during commit, before this effect runs, so by the time this checks
  whether focus already landed inside the sheet, it usually has.
*/
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Sheet({ title, children, onClose, wide }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    const node = sheetRef.current;
    const previouslyFocused = document.activeElement;

    const focusables = () => Array.from(node.querySelectorAll(FOCUSABLE));
    if (!node.contains(document.activeElement)) {
      (focusables()[0] || node).focus();
    }

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div className="fb-scrim" onClick={onClose}>
      <div
        ref={sheetRef}
        className={`fb-sheet${wide ? " is-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
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
