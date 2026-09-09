import { stepAnchor } from "../../lib/date.js";
import { Avatar } from "./Avatar.jsx";
import { Chevron } from "./icons.jsx";

/*
  Footer — the legend is also the filter.

  Moved verbatim from family-board.jsx:1035-1082.

  Two things later roles need from this file:

    - The view list used to be hardcoded here. R10 made it mode-derived — the
      To-do tab exists in Roommate mode only, the single feature difference
      between the two modes (PLAN.md §R10 item 5) — by lifting the list into
      a `views` prop that App.jsx computes from ModeContext. Whatever App
      passes is what renders; this component no longer knows "day" from
      "todo".
    - Paging used to be chevron-only. R12's item 2 added pointer-event swipe
      paging for day and week (src/hooks/useSwipePage.js, wired in App.jsx on
      the stage). Both call sites step through `stepAnchor` in lib/date.js so
      the stepping logic — a month at a time in month view, seven days in
      week, one day otherwise — exists in exactly one place.
*/
/* Only "todo" needs a spelling the capitalize-first-letter default can't
   produce — SCOPING.txt writes it "To-do". Every other view id is already
   its own display label. */
const VIEW_LABELS = { todo: "To-do" };

export function Footer({
  view,
  setView,
  views,
  anchor,
  setAnchor,
  members,
  isShown,
  onToggleMember,
  showReset,
  onReset,
  onCompose,
}) {
  const page = (dir) => setAnchor(stepAnchor(view, anchor, dir));

  return (
    <footer className="fb-foot">
      <div className="fb-views">
        {views.map((v) => (
          <button
            key={v}
            className={`fb-view${view === v ? " is-on" : ""}`}
            onClick={() => setView(v)}
          >
            {VIEW_LABELS[v] || v[0].toUpperCase() + v.slice(1)}
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
