import { useEffect, useRef, useState } from "react";

import { addDays, sameDay, startOfWeek, DOW } from "../../lib/date.js";
import { layoutSpans } from "../../lib/spans.js";
import { SpanBar, spanGeometry } from "./SpanBar.jsx";
import { usePalette } from "../../state/PaletteContext.js";
import { WEATHER_ICONS } from "../weather/weatherIcons.js";
import { WeatherDaySheet } from "../weather/WeatherDaySheet.jsx";
import { fmtTemp } from "../weather/weatherRows.js";
import { MemberPicker } from "../shell/MemberPicker.jsx";

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

  Events are no longer laid out per cell. A cell used to filter the whole
  list itself and stack its own chips, which meant a multi-day event drew an
  identical chip in each cell it touched with nothing to say the chips were
  one event; a four-day trip read as four unrelated entries. The grid is
  therefore built a week at a time — `.fb-weekrow` per row, seven `.fb-cell`
  buttons plus one positioned overlay — and `layoutSpans` (src/lib/spans.js,
  shared with Week's all-day band) places one bar per event across the days
  it covers, continuing flat-edged into the weeks either side of it.

  Timed events go through the same call rather than keeping a separate
  per-cell path: a timed event is simply a span of one, and running both
  kinds through one lane assignment is what keeps a day's stack in a
  sensible order instead of interleaving two independent stacks.

  The overlay sits above the cells and is `pointer-events: none` (see
  MonthView.js) so an empty patch of cell still reaches the cell's own
  `onPick`; the bars re-enable pointer events for themselves. A bar is a
  real `<button>` now, not the `role="button"` span the old chips had to be
  to stay valid HTML inside the cell button — it is a sibling of the cells,
  not a child.

  `maxLanes` is measured rather than fixed: a row is ~84px tall in a
  five-week month and ~69px in a six-week one, which is three lanes in the
  first case and two in the second, and a constant would be wrong for one of
  them. The observer only ever narrows from LANES_FALLBACK, which is what
  jsdom (no layout, no ResizeObserver) and the first paint both get.

  The home/member-picker icon sits at the left of `.fb-monthtoolbar`,
  directly across from the weather toggle on the right — the toolbar row
  now always renders (it used to be gated on `weather`) since the home icon
  needs a home regardless of whether a weather location is configured.
  `roster`/`isShown`/`onToggleMember`/`filterTouched`/`onReset` are threaded
  straight through from App.jsx, the same values Header used to receive;
  HeaderControls no longer renders its own copy for this view.

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

/* Must track MonthView.js: .fb-grid's gap and .fb-cell's horizontal padding.
   The bars are positioned against the row, not inside a cell, so they have
   to reproduce that geometry to line up with the day numbers above them. */
const CELL_GAP = 6;
const CELL_INSET = 7;
/* Cell padding-top (6) + the day-number row (16), then a 2px breath under it;
   EVENTS_BOTTOM is the matching margin at the foot of the cell. Measured
   against a rendered board rather than derived from font metrics, so a type
   change here needs re-checking there. */
const EVENTS_TOP = 24;
const EVENTS_BOTTOM = 4;
/* .fb-cellev's height and the gap under it. 17px is what 11px Archivo needs
   for a line box that does not cut the tail off a descender. */
const LANE_GAP = 2;
const LANE_H = 17 + LANE_GAP;
const LANES_FALLBACK = 3;

export function MonthView({
  date,
  now,
  events,
  weather,
  settings,
  onPick,
  onSelect,
  roster,
  isShown,
  onToggleMember,
  filterTouched,
  onReset,
}) {
  const { fillFor } = usePalette();
  const [showForecast, setShowForecast] = useState(false);
  const [forecastDay, setForecastDay] = useState(null);

  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const cut = cells.findIndex((d, i) => i % 7 === 0 && d > last);
  const visible = cells.slice(0, cut > 0 ? cut : 42);
  const weeks = Array.from({ length: visible.length / 7 }, (_, w) =>
    visible.slice(w * 7, w * 7 + 7),
  );

  const gridRef = useRef(null);
  const [maxLanes, setMaxLanes] = useState(LANES_FALLBACK);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    /*
      offsetHeight, not getBoundingClientRect: the board is a fixed 1080x810
      canvas that Fit.jsx CSS-transforms to whatever the screen is, and a
      rect is measured after that transform. Subtracting the untransformed
      EVENTS_TOP/LANE_H from a scaled height overcounts the lanes by the
      scale factor, which on a 1280-wide window fitted one more bar into
      each row than the row could actually show.
    */
    const measure = () => {
      const rowH = grid.firstElementChild?.offsetHeight ?? 0;
      if (rowH <= 0) return;
      /* n lanes need n bars and n-1 gaps, not n of each — the trailing gap
         is imaginary, and rounding it in costs a whole lane at these sizes. */
      const room = rowH - EVENTS_TOP - EVENTS_BOTTOM;
      setMaxLanes(Math.max(1, Math.floor((room + LANE_GAP) / LANE_H)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [weeks.length]);

  const TodayIcon = weather ? WEATHER_ICONS[weather.condition] || WEATHER_ICONS.sunny : null;

  return (
    <div className="fb-monthwrap">
      <div className="fb-monthtoolbar">
        <MemberPicker
          members={roster}
          isShown={isShown}
          onToggleMember={onToggleMember}
          showReset={filterTouched}
          onReset={onReset}
          align="left"
        />
        {weather && (
          <button
            className="fb-monthweather"
            onClick={() => setShowForecast((v) => !v)}
            aria-label={showForecast ? "Hide forecast" : "Show forecast"}
            aria-pressed={showForecast}
          >
            <TodayIcon />
          </button>
        )}
      </div>
      <div className="fb-monthhead">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div
        className="fb-grid"
        ref={gridRef}
        style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}
      >
        {weeks.map((week, w) => {
          const row = layoutSpans(events, week, { maxLanes });
          return (
            <div className="fb-weekrow" key={w}>
              {week.map((d, i) => {
                const outside = d.getMonth() !== date.getMonth();
                const today = sameDay(d, now);
                const forecast = showForecast
                  ? weather?.daily.find((wd) => sameDay(wd.date, d))
                  : null;
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
                  </button>
                );
              })}

              <div className="fb-rowevents" style={{ top: EVENTS_TOP, bottom: EVENTS_BOTTOM }}>
                {row.bars.map((bar) => (
                  <SpanBar
                    key={bar.event.id}
                    bar={bar}
                    columns={week.length}
                    laneH={LANE_H}
                    gap={CELL_GAP}
                    inset={CELL_INSET}
                    className="fb-cellev"
                    fill={fillFor(bar.event)}
                    onSelect={onSelect}
                  />
                ))}
                {row.more.map((count, i) =>
                  count > 0 ? (
                    <button
                      key={`more-${i}`}
                      className="fb-cellmore"
                      style={{
                        ...spanGeometry(
                          { startIdx: i, span: 1 },
                          week.length,
                          CELL_GAP,
                          CELL_INSET,
                        ),
                        top: row.moreLane * LANE_H,
                      }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onPick(week[i]);
                      }}
                    >
                      {count} more
                    </button>
                  ) : null,
                )}
              </div>
            </div>
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
