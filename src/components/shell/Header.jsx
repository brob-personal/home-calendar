import { sameDay, fmtClock, DOW_LONG } from "../../lib/date.js";
import { MONTH_ART } from "../../lib/theme.js";
import { Gear } from "./icons.jsx";

/*
  Moved verbatim from family-board.jsx:710-739.

  Note the asymmetry, which is intentional and easy to "fix" by mistake: the
  big date reads from `anchor` (whatever day you have paged to) while the
  clock and the event count read from `now`. The count is "how many things are
  on today", not "on the day you are looking at" — so paging away leaves it
  alone and surfaces the "Back to today" chip instead.

  MONTH_ART is imported for its twelve month *names*, not its gradients. That
  coupling came with the move; R5 may want to separate the two when the art
  becomes a token.

  R6's weather is destined for this header — collapsed to an icon plus °F,
  expanding on tap.
*/
export function Header({ now, anchor, events, onToday, onSettings }) {
  const isToday = sameDay(anchor, now);
  const todayCount = events.filter((e) => !e.allDay && sameDay(e.start, now)).length;

  return (
    <header className="fb-head">
      <div className="fb-datestack">
        <span className="fb-dow">{DOW_LONG[anchor.getDay()]}</span>
        <span className="fb-num">{anchor.getDate()}</span>
      </div>
      <div className="fb-headmeta">
        <div className="fb-month">
          {MONTH_ART[anchor.getMonth()].name} {anchor.getFullYear()}
        </div>
        <div className="fb-sub">
          {todayCount === 0 ? "Nothing scheduled today" : `${todayCount} today`}
        </div>
      </div>
      <div className="fb-headright">
        <div className="fb-clock">{fmtClock(now)}</div>
        {!isToday && (
          <button className="fb-chip" onClick={onToday}>
            Back to today
          </button>
        )}
        <button className="fb-icon" onClick={onSettings} aria-label="Open settings">
          <Gear />
        </button>
      </div>
    </header>
  );
}
