import { useState } from "react";

import { fmtTime } from "../../lib/date.js";
import { useExpandable } from "../../hooks/useExpandable.js";
import { WeatherStyles } from "./WeatherStyles.jsx";
import { WEATHER_ICONS } from "./weatherIcons.js";
import { fmtTemp as fmt, buildWeatherRows as buildRows } from "./weatherRows.js";
import { WeatherRowList } from "./WeatherRowList.jsx";

/* A reading older than this is worth a quiet "updated" note in the expanded
   panel — item 5's "stale weather, not an error" made visible rather than
   silent. Well under the 15-minute poll interval in ./useWeather.js, so this
   only ever fires once the network has actually been down a while. */
const STALE_MS = 45 * 60 * 1000;

/**
 * The header's weather chip and its expandable detail panel — PLAN.md §R6
 * items 3 and 4. `now` is Header's own clock (App.jsx passes it down), not a
 * second timer here, so the "current hour" cutoff and the stale-reading note
 * stay in step with the rest of the board.
 *
 * `snapshot` comes from App's single `useWeather()` call rather than a hook
 * of its own — MonthView needs the same reading for its per-day forecast,
 * and two independent pollers would mean two Open-Meteo requests every
 * fifteen minutes for one board.
 */
export function WeatherWidget({ now, snapshot, timeFormat }) {
  const [open, setOpen] = useState(false);
  const { mounted, closing } = useExpandable(open, 160);

  if (!snapshot) return null;

  const Icon = WEATHER_ICONS[snapshot.condition] || WEATHER_ICONS.sunny;
  const stale = now - snapshot.fetchedAt > STALE_MS;
  const rows = mounted ? buildRows(snapshot, now) : [];

  return (
    <div className="fb-weather">
      <WeatherStyles />
      <button
        className="fb-weatherchip"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Collapse weather" : "Expand weather"}
        aria-expanded={open}
      >
        <Icon />
        <span className="fb-weathertemp">
          {fmt(snapshot.temp)}
          {snapshot.units}
        </span>
      </button>

      {mounted && (
        <div
          className={`fb-weatherpanel${closing ? " fb-weatherpanel--closing" : ""}`}
          role="group"
          aria-label={snapshot.location.label ? `Weather for ${snapshot.location.label}` : "Weather"}
        >
          <div className="fb-weatherhilo">
            <span className="fb-weatherhi">H {fmt(snapshot.hi)}</span>
            <span className="fb-weatherlo">L {fmt(snapshot.lo)}</span>
          </div>

          <WeatherRowList rows={rows} timeFormat={timeFormat} />

          {stale && (
            <div className="fb-weatherstale">
              Updated {fmtTime(snapshot.fetchedAt, timeFormat)} — offline
            </div>
          )}
        </div>
      )}
    </div>
  );
}
