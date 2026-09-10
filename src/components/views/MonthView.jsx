import { useState } from "react";

import { addDays, sameDay, spansDay, startOfWeek, DOW } from "../../lib/date.js";
import { usePalette } from "../../state/PaletteContext.js";
import { WEATHER_ICONS } from "../weather/weatherIcons.js";
import { WeatherDaySheet } from "../weather/WeatherDaySheet.jsx";
import { fmtTemp } from "../weather/weatherRows.js";

/*
  Month — moved from family-board.jsx:931-974.

  One change, per PLAN.md §R2 item 5: `fill` was a prop and is now read from
  PaletteContext. `onPick` stays a prop — it navigates, which is App's
  business.

  Deferred Defect #9 is the `cut` calculation, flagged as "subtle and
  uncommented" and assigned to R13 to test. Since R2 may not change it, here
  is what it does instead.

  The grid always starts on the Sunday at or before the 1st, and 42 cells is
  six weeks — enough to hold any month in any alignment. Most months need
  only five. `cut` finds the index of the first cell that both begins a week
  (`i % 7 === 0`) and falls entirely past the last of the month, and the slice
  drops that trailing week. The `cut > 0` guard covers findIndex returning -1
  when all six rows are needed; it also happens to cover index 0, which
  cannot occur because the first cell is never past the last of the month.
  Dropping whole weeks rather than trailing cells is what keeps
  `visible.length / 7` an exact row count for grid-template-rows.

  `onSelect` is R7's addition (PLAN.md §R7 item 5): a chip tap opens the
  EventDetailSheet instead of the cell's own onPick navigation, so it needs
  its own handler with stopPropagation — the cell itself is already a button
  and a chip is a nested span, not a nested button, so this stays valid HTML.

  Per-cell event list: a timed event still matches only its own day
  (`sameDay(e.start, d)`), but an all-day event matches every day it spans
  (`spansDay`) rather than only its start day — otherwise a multi-day event
  (a trip, a holiday) only ever showed a chip on the first cell it touched.

  The forecast toggle and per-day breakdown, added alongside R6's Month-view
  extension: `weather` is the same WeatherSnapshot Header's chip shows
  (App.jsx makes the one `useWeather()` call and threads it to both), so no
  second network poller. `showForecast` gates the H/L text rather than the
  weather icon always taking up cell space — a wall board with no weather
  configured, or one where nobody's tapped the toggle, looks exactly as it
  did before this landed. The H/L text is its own tap target with
  stopPropagation, same pattern as the event chip above: tapping a day
  number/empty cell still navigates via `onPick`, tapping H/L opens that
  day's WeatherDaySheet instead.
*/
export function MonthView({ date, now, events, weather, settings, onPick, onSelect }) {
  const { fillFor } = usePalette();
  const [showForecast, setShowForecast] = useState(false);
  const [forecastDay, setForecastDay] = useState(null);

  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const cut = cells.findIndex((d, i) => i % 7 === 0 && d > last);
  const visible = cells.slice(0, cut > 0 ? cut : 42);

  const TodayIcon = weather ? WEATHER_ICONS[weather.condition] || WEATHER_ICONS.sunny : null;

  return (
    <div className="fb-monthwrap">
      {weather && (
        <div className="fb-monthtoolbar">
          <button
            className="fb-monthweather"
            onClick={() => setShowForecast((v) => !v)}
            aria-label={showForecast ? "Hide forecast" : "Show forecast"}
            aria-pressed={showForecast}
          >
            <TodayIcon />
          </button>
        </div>
      )}
      <div className="fb-monthhead">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="fb-grid" style={{ gridTemplateRows: `repeat(${visible.length / 7}, 1fr)` }}>
        {visible.map((d, i) => {
          const outside = d.getMonth() !== date.getMonth();
          const today = sameDay(d, now);
          const list = events.filter((e) => (e.allDay ? spansDay(e, d) : sameDay(e.start, d)));
          const forecast = showForecast ? weather?.daily.find((wd) => sameDay(wd.date, d)) : null;
          return (
            <button
              key={i}
              className={`fb-cell${outside ? " is-outside" : ""}${today ? " is-today" : ""}`}
              onClick={() => onPick(d)}
            >
              <span className="fb-cellnumrow">
                <span className="fb-cellnum">{d.getDate()}</span>
                {forecast && (
                  <span
                    className="fb-cellhilo"
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setForecastDay(forecast);
                    }}
                  >
                    H{fmtTemp(forecast.hi)} L{fmtTemp(forecast.lo)}
                  </span>
                )}
              </span>
              <span className="fb-cellevents">
                {list.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="fb-cellev"
                    style={{ background: fillFor(e) }}
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelect(e);
                    }}
                  >
                    {e.title}
                  </span>
                ))}
                {list.length > 3 && <span className="fb-cellmore">{list.length - 3} more</span>}
              </span>
            </button>
          );
        })}
      </div>

      {forecastDay && (
        <WeatherDaySheet
          day={forecastDay}
          now={now}
          timeFormat={settings?.timeFormat}
          onClose={() => setForecastDay(null)}
        />
      )}
    </div>
  );
}
