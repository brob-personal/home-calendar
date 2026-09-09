import { useState } from "react";

import { fmtTime } from "../../lib/date.js";
import { useWeather } from "./useWeather.js";
import { WeatherStyles } from "./WeatherStyles.jsx";
import { Sunny, PartlyCloudy, Cloudy, Rain, Snow } from "./icons.jsx";

/*
  The condition-to-icon map lives here, not in ./icons.jsx, so that file stays
  components-only — same reason ../shell/icons.jsx has no map of its own.
  Mixing a component export with a plain-object export in one file trips
  react-refresh/only-export-components.
*/
const WEATHER_ICONS = {
  sunny: Sunny,
  partly: PartlyCloudy,
  cloudy: Cloudy,
  rain: Rain,
  snow: Snow,
};

/* A reading older than this is worth a quiet "updated" note in the expanded
   panel — item 5's "stale weather, not an error" made visible rather than
   silent. Well under the 15-minute poll interval in ./useWeather.js, so this
   only ever fires once the network has actually been down a while. */
const STALE_MS = 45 * 60 * 1000;

function fmt(v) {
  return Number.isFinite(v) ? `${Math.round(v)}°` : "--";
}

/*
  One combined, time-ordered list rather than separate hourly / sunrise-sunset
  / UV sections — PLAN.md §R6 item 4 asks for "hourly temperature, hourly
  precipitation chance, sunrise and sunset in the same list, and peak UV time
  with its index," which reads as one list with those rows interleaved at
  their actual hour, not four widget sections. Filtered to the current hour
  onward: forecast_days=1 returns the whole local day, and a wall board asks
  "what's coming", not "what already happened this morning".
*/
function buildRows(snapshot, now) {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const rows = [
    ...snapshot.hourly.map((h) => ({
      type: "hour",
      at: h.at,
      temp: h.temp,
      precipChance: h.precipChance,
    })),
    { type: "sunrise", at: snapshot.sunrise },
    { type: "sunset", at: snapshot.sunset },
    ...(snapshot.uvPeak
      ? [{ type: "uv", at: snapshot.uvPeak.at, index: snapshot.uvPeak.index }]
      : []),
  ];
  return rows
    .filter((r) => r.at instanceof Date && !Number.isNaN(r.at.getTime()) && r.at >= cutoff)
    .sort((a, b) => a.at - b.at);
}

/**
 * The header's weather chip and its expandable detail panel — PLAN.md §R6
 * items 3 and 4. `now` is Header's own clock (App.jsx passes it down), not a
 * second timer here, so the "current hour" cutoff and the stale-reading note
 * stay in step with the rest of the board.
 */
export function WeatherWidget({ now }) {
  const snapshot = useWeather();
  const [open, setOpen] = useState(false);

  if (!snapshot) return null;

  const Icon = WEATHER_ICONS[snapshot.condition] || WEATHER_ICONS.sunny;
  const stale = now - snapshot.fetchedAt > STALE_MS;
  const rows = open ? buildRows(snapshot, now) : [];

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

      {open && (
        <div
          className="fb-weatherpanel"
          role="group"
          aria-label={snapshot.location.label ? `Weather for ${snapshot.location.label}` : "Weather"}
        >
          <div className="fb-weatherhilo">
            <span className="fb-weatherhi">H {fmt(snapshot.hi)}</span>
            <span className="fb-weatherlo">L {fmt(snapshot.lo)}</span>
          </div>

          <ul className="fb-weatherlist">
            {rows.map((r, i) => (
              <li key={i} className={`fb-weatherrow fb-weatherrow-${r.type}`}>
                {r.type === "hour" && (
                  <>
                    <span className="fb-weatherrowtime">{fmtTime(r.at)}</span>
                    <span className="fb-weatherrowtemp">{fmt(r.temp)}</span>
                    <span className="fb-weatherrowprecip">{Math.round(r.precipChance)}%</span>
                  </>
                )}
                {r.type === "sunrise" && (
                  <span className="fb-weatherrowlabel">Sunrise · {fmtTime(r.at)}</span>
                )}
                {r.type === "sunset" && (
                  <span className="fb-weatherrowlabel">Sunset · {fmtTime(r.at)}</span>
                )}
                {r.type === "uv" && (
                  <span className="fb-weatherrowlabel">
                    Peak UV · {fmtTime(r.at)} · index {Math.round(r.index)}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {stale && <div className="fb-weatherstale">Updated {fmtTime(snapshot.fetchedAt)} — offline</div>}
        </div>
      )}
    </div>
  );
}
