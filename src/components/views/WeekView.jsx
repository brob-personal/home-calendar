import { addDays, sameDay, spansDay, startOfWeek, minutesInto, fmtTime, fmtRange, DOW } from "../../lib/date.js";
import { usePalette } from "../../state/PaletteContext.js";
import { layoutOverlaps } from "../../lib/layout.js";
import { TimeGutter } from "./TimeGutter.jsx";
import { SHORT_MIN, eventTier } from "../../lib/eventBox.js";

/*
  Week — moved from family-board.jsx:854-928.

  One change, per PLAN.md §R2 item 5: `fill` was a prop threaded down from the
  root and is now read from PaletteContext.

  HOUR_H is the row height in px for one hour, and it is the number the whole
  grid is derived from: the grid's total height, each `.fb-hourline`, the
  now-line's `top`, and every block's top and height. Changing it rescales the
  view coherently.

  R7 extracted the hour column into `./TimeGutter.jsx` so Day and Week share
  one rendering of the hour labels instead of two copies drifting apart —
  PLAN.md §R7 item 2. The styles it renders against (`.fb-gutter`, `.fb-hours`,
  `.fb-hour`) still live in styles/week.js, unchanged.

  `onSelect` is new: PLAN.md §R7 item 5 requires events be inspectable from
  every view, not just Day, so a block tap opens the same EventDetailSheet
  App.jsx wires up for Day. `.fb-wblock` becomes a button for it; the global
  button reset in root.js means that costs no visual diff.

  Overlap layout: two events on the same day at overlapping times used to
  stack directly on top of each other. `layoutOverlaps` (src/lib/layout.js,
  shared with DayView) now cascades whatever is overlapping at that moment —
  fixed readable width, staggered left offset, higher z-index for later
  events — purely as left/width/zIndex on top of the existing top/height
  positioning — `fillFor`'s diagonal split-fill colouring is untouched.

  All-day row: Week used to drop `allDay` events on the floor entirely — the
  timed `list` filter excluded them and nothing else rendered them. `fb-
  weekallday` mirrors `fb-weekhead`'s gutter-plus-seven-columns layout, one
  `fb-alldaychip` per day a given event spans (`spansDay`, not a single
  `sameDay(e.start, d)` check), so a multi-day event repeats across the days
  it covers rather than appearing once — the same chip idiom DayView already
  used, not a spanning bar, so the two views keep reading as one system.
*/
const HOUR_H = 34;

export function WeekView({ date, now, events, settings, onSelect }) {
  const { fillFor } = usePalette();

  const start = startOfWeek(date);
  const hours = [];
  for (let h = settings.dayStart; h < settings.dayEnd; h++) hours.push(h);
  const spanStart = settings.dayStart * 60;
  const spanEnd = settings.dayEnd * 60;
  const gridH = hours.length * HOUR_H;

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const nowTop = ((minutesInto(now) - spanStart) / 60) * HOUR_H;
  const nowVisible = minutesInto(now) >= spanStart && minutesInto(now) <= spanEnd;

  return (
    <div className="fb-week">
      <div className="fb-weekhead">
        <span className="fb-gutter" />
        {days.map((d, i) => (
          <div className={`fb-whead${sameDay(d, now) ? " is-today" : ""}`} key={i}>
            <span className="fb-wdow">{DOW[d.getDay()]}</span>
            <span className="fb-wnum">{d.getDate()}</span>
          </div>
        ))}
      </div>

      <div className="fb-weekallday">
        <span className="fb-gutter" />
        {days.map((d, i) => (
          <div className="fb-walldaycol" key={i}>
            {events
              .filter((e) => e.allDay && spansDay(e, d))
              .map((e) => (
                <button key={e.id} className="fb-alldaychip" onClick={() => onSelect(e)}>
                  {e.title}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="fb-weekbody">
        <div className="fb-weekgrid" style={{ height: gridH }}>
          <TimeGutter hours={hours} hourH={HOUR_H} />

          {days.map((d, i) => {
            const today = sameDay(d, now);
            const list = events.filter((e) => sameDay(e.start, d) && !e.allDay);
            const cols = layoutOverlaps(list);
            return (
              <div className={`fb-wcol${today ? " is-today" : ""}`} key={i}>
                {hours.map((h) => (
                  <div className="fb-hourline" style={{ height: HOUR_H }} key={h} />
                ))}
                {today && nowVisible && (
                  <div className="fb-nowrow" style={{ top: nowTop }}>
                    <span className="fb-nowdot" />
                  </div>
                )}
                {list.map((e) => {
                  const s = Math.max(minutesInto(e.start), spanStart);
                  const en = Math.min(minutesInto(e.end), spanEnd);
                  const { left, width, z } = cols.get(e);
                  const durMin = en - s;
                  const tier = eventTier(durMin);
                  const height =
                    tier === "condensed"
                      ? (SHORT_MIN / 60) * HOUR_H - 2
                      : ((en - s) / 60) * HOUR_H - 2;
                  return (
                    <button
                      key={e.id}
                      className={`fb-wblock${tier === "stacked" ? " is-stacked" : " is-compact"}`}
                      style={{
                        top: ((s - spanStart) / 60) * HOUR_H,
                        height,
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        right: "auto",
                        zIndex: z,
                        background: fillFor(e),
                      }}
                      onClick={() => onSelect(e)}
                    >
                      <span className="fb-wbtitle">{e.title}</span>
                      <span className="fb-wbtime">
                        {tier === "stacked" ? fmtRange(e.start, e.end) : fmtTime(e.start)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
