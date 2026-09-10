import { fmtLongDate } from "../../lib/date.js";
import { Sheet } from "../shell/Sheet.jsx";
import { WeatherStyles } from "./WeatherStyles.jsx";
import { WeatherRowList } from "./WeatherRowList.jsx";
import { fmtTemp as fmt, buildWeatherRows as buildRows } from "./weatherRows.js";

/**
 * MonthView's per-day forecast breakdown — the hi/lo, hourly temps and
 * precip chance, sunrise/sunset and peak UV for one `WeatherDay`
 * (../../contracts/schema.js), reusing the same row markup and hi/lo layout
 * as the header's expanded WeatherWidget panel. `now` only matters when
 * `day` is today, to keep the "current hour onward" trim consistent with the
 * header widget rather than showing hours that have already passed.
 */
export function WeatherDaySheet({ day, now, onClose }) {
  const rows = buildRows(day, now);

  return (
    <Sheet title={fmtLongDate(day.date)} onClose={onClose}>
      <WeatherStyles />
      <div className="fb-weatherhilo">
        <span className="fb-weatherhi">H {fmt(day.hi)}</span>
        <span className="fb-weatherlo">L {fmt(day.lo)}</span>
      </div>
      <WeatherRowList rows={rows} />
    </Sheet>
  );
}
