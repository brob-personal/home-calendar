import { sameDay, fmtClock, DOW_LONG } from "../../lib/date.js";
import { MONTH_ART } from "../../lib/theme.js";
import { WeatherWidget } from "../weather/WeatherWidget.jsx";
import { HeaderControls } from "./HeaderControls.jsx";

/*
  Header redesign: the left side is now purely static "what day is it"
  info — weekday, date number, month/year, today's count, weather and the
  clock all live here and never change what the board is showing. Every
  control that alters something (pager, view switch, member filter,
  settings) moved to <HeaderControls>, on the right — see that file for
  what used to live in Footer.jsx.

  Weather and the clock used to sit in the right-hand button cluster; they
  are read-only displays, not controls, so they moved into the left block
  instead of getting folded into HeaderControls.

  Note the asymmetry, which is intentional and easy to "fix" by mistake: the
  big date reads from `anchor` (whatever day you have paged to) while the
  clock and the event count read from `now`. The count is "how many things are
  on today", not "on the day you are looking at" — so paging away leaves it
  alone and surfaces the "Back to today" chip instead.

  MONTH_ART is imported for its twelve month *names*, not its gradients. That
  coupling came with the move; R5 may want to separate the two when the art
  becomes a token.

  R6 landed here: <WeatherWidget> renders nothing until settings.weather has
  a location — see ../weather/WeatherWidget.jsx. `weather` itself is fetched
  once in App.jsx and passed down as a prop, not read from a hook in here,
  so MonthView's forecast can share the same reading instead of polling
  Open-Meteo a second time.

  R12 item 4: `degraded` is one boolean covering both of useBoardData's
  failure signals — a source that fell back to cached events, or a storage
  write that failed — so the board says so quietly instead of pretending
  everything is fine. Reuses `.fb-chip`, the same pill "Back to today"
  already uses, rather than introducing a second visual language for status.
*/
export function Header({
  now,
  anchor,
  events,
  weather,
  degraded,
  onToday,
  onSettings,
  view,
  setView,
  views,
  setAnchor,
  roster,
  isShown,
  onToggleMember,
  filterTouched,
  onReset,
}) {
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
        <div className="fb-headinfo">
          <WeatherWidget now={now} snapshot={weather} />
          <span className="fb-clock">{fmtClock(now)}</span>
        </div>
      </div>

      <HeaderControls
        degraded={degraded}
        isToday={isToday}
        onToday={onToday}
        view={view}
        setView={setView}
        views={views}
        anchor={anchor}
        setAnchor={setAnchor}
        roster={roster}
        isShown={isShown}
        onToggleMember={onToggleMember}
        filterTouched={filterTouched}
        onReset={onReset}
        onSettings={onSettings}
      />
    </header>
  );
}
