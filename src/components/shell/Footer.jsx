import { addDays } from "../../lib/date.js";
import { Avatar } from "./Avatar.jsx";
import { Chevron } from "./icons.jsx";

/*
  Footer — the legend is also the filter.

  Moved verbatim from family-board.jsx:1035-1082.

  Two things later roles need from this file:

    - The view list is hardcoded here. R10's backlog item 5 makes it
      mode-derived, because the To-do tab exists in Roommate mode only and is
      the single feature difference between the two modes.
    - Paging is chevron-only. R12's item 2 adds pointer-event swipe paging for
      day and week; `page()` below is the function that swipe should call, so
      the stepping logic — a month at a time in month view, seven days in
      week, one day otherwise — does not get reimplemented.
*/
export function Footer({
  view,
  setView,
  anchor,
  setAnchor,
  members,
  isShown,
  onToggleMember,
  showReset,
  onReset,
  onCompose,
}) {
  const page = (dir) => {
    if (view === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else setAnchor(addDays(anchor, (view === "week" ? 7 : 1) * dir));
  };

  return (
    <footer className="fb-foot">
      <div className="fb-views">
        {["day", "week", "month", "agenda"].map((v) => (
          <button
            key={v}
            className={`fb-view${view === v ? " is-on" : ""}`}
            onClick={() => setView(v)}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <div className="fb-legend">
        {members.map((m) => {
          const on = isShown(m.id);
          return (
            <button
              key={m.id}
              className={`fb-leg${on ? "" : " is-off"}`}
              onClick={() => onToggleMember(m.id)}
              aria-pressed={on}
              title={on ? `Hide ${m.name}` : `Show ${m.name}`}
            >
              <Avatar member={m} size={30} off={!on} />
              {m.name}
            </button>
          );
        })}
        {showReset && (
          <button className="fb-chip" onClick={onReset}>
            Reset
          </button>
        )}
      </div>

      <div className="fb-pager">
        <button className="fb-icon" onClick={() => page(-1)} aria-label="Previous">
          <Chevron dir="left" />
        </button>
        <button className="fb-icon" onClick={() => page(1)} aria-label="Next">
          <Chevron dir="right" />
        </button>
        <button className="fb-primary" onClick={onCompose}>
          New event
        </button>
      </div>
    </footer>
  );
}
