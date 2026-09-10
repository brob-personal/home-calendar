import { sameDay, fmtClock, DOW_LONG } from "../../lib/date.js";
import { MONTH_ART } from "../../lib/theme.js";
import { useAnchorDirection } from "../../hooks/useAnchorDirection.js";
import { WeatherWidget } from "../weather/WeatherWidget.jsx";
import { HeaderControls } from "./HeaderControls.jsx";
import { Roller } from "./Roller.jsx";

/* Every date the roller could ever show, purely to reserve max width — see
   .fb-roller in styles/shell/Header.js. */
const DATE_DIGITS = Array.from({ length: 31 }, (_, i) => String(i + 1));

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
  alone; the view dropdown surfaces a "Return to Today" option instead.

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
  everything is fine. Reuses `.fb-chip`, the same pill the Offline status
  uses, rather than introducing a second visual language for status.
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
  const dir = useAnchorDirection(anchor);

  return (
    <header className="fb-head">
      <div className="fb-datestack">
        <Roller className="fb-dow" value={DOW_LONG[anchor.getDay()]} allValues={DOW_LONG} dir={dir} />
        <Roller className="fb-num" value={String(anchor.getDate())} allValues={DATE_DIGITS} dir={dir} />
      </div>
      <div className="fb-headmeta">
        <div className="fb-month">
          <span className="fb-monthname">
            {MONTH_ART.map((m, i) => (
              <span key={m.name} className={i === anchor.getMonth() ? "is-active" : undefined}>
                {m.name}
              </span>
            ))}
          </span>{" "}
          {anchor.getFullYear()}
        </div>
        <div className="fb-sub">
          {todayCount === 0 ? "Nothing scheduled today" : `${todayCount} Events Today`}
        </div>
        <div className="fb-headinfo">
          <span className="fb-clock">{fmtClock(now)}</span>
          <WeatherWidget now={now} snapshot={weather} />
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
