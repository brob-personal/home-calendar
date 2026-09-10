import { fmtTime } from "../../lib/date.js";
import { fmtTemp as fmt } from "./weatherRows.js";
import { Clock, Sunny, Rain } from "./icons.jsx";

/*
  The hour/sunrise/sunset/uv row markup, shared by WeatherWidget's expanded
  panel and WeatherDaySheet's per-day breakdown — pulled out once both needed
  it rather than duplicated. `rows` is whatever ./weatherRows.js#buildWeatherRows
  returned.

  The `.fb-weathercols` legend (Clock/Sunny/Rain over the time/temp/precip
  columns) lives here rather than only in WeatherWidget, so WeatherDaySheet's
  per-day breakdown gets the same column labels for free.
*/
export function WeatherRowList({ rows }) {
  return (
    <>
      <div className="fb-weathercols" aria-hidden="true">
        <span className="fb-weatherrowtime">
          <Clock />
        </span>
        <span className="fb-weatherrowtemp">
          <Sunny />
        </span>
        <span className="fb-weatherrowprecip">
          <Rain />
        </span>
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
    </>
  );
}
