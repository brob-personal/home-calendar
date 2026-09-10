import { stepAnchor } from "../../lib/date.js";
import { Chevron, Gear } from "./icons.jsx";
import { ViewSwitcher } from "./ViewSwitcher.jsx";
import { MemberPicker } from "./MemberPicker.jsx";

/*
  The header's right-hand cluster — every "altering" control on the board,
  now in one place: the Offline/Back-to-today chips Header used to render
  itself, Footer's pager and view switcher, and Footer's member-filter
  legend (folded into MemberPicker's popover). Footer.jsx is gone; the only
  thing that used to live in it and doesn't live here is "New event", which
  NoteDock's own FAB menu already offered as a second way in — see
  ../notes/NoteDock.jsx.
*/
export function HeaderControls({
  degraded,
  isToday,
  onToday,
  view,
  setView,
  views,
  anchor,
  setAnchor,
  roster,
  isShown,
  onToggleMember,
  filterTouched,
  onReset,
  onSettings,
}) {
  const page = (dir) => setAnchor(stepAnchor(view, anchor, dir));

  return (
    <div className="fb-headright">
      {degraded && (
        <span className="fb-chip" title="Showing the last saved events and settings">
          Offline
        </span>
      )}
      {!isToday && (
        <button className="fb-chip" onClick={onToday}>
          Back to today
        </button>
      )}
      <div className="fb-pager">
        <button className="fb-icon" onClick={() => page(-1)} aria-label="Previous">
          <Chevron dir="left" />
        </button>
        <button className="fb-icon" onClick={() => page(1)} aria-label="Next">
          <Chevron dir="right" />
        </button>
      </div>
      <ViewSwitcher view={view} setView={setView} views={views} />
      <MemberPicker
        members={roster}
        isShown={isShown}
        onToggleMember={onToggleMember}
        showReset={filterTouched}
        onReset={onReset}
      />
      <button className="fb-icon" onClick={onSettings} aria-label="Open settings">
        <Gear />
      </button>
    </div>
  );
}
