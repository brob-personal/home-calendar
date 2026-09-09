import { addDays, sameDay, startOfWeek, minutesInto, fmtTime, DOW } from "../../lib/date.js";
import { usePalette } from "../../state/PaletteContext.js";

/*
  Week — moved from family-board.jsx:854-928.

  One change, per PLAN.md §R2 item 5: `fill` was a prop threaded down from the
  root and is now read from PaletteContext.

  HOUR_H is the row height in px for one hour, and it is the number the whole
  grid is derived from: the grid's total height, each `.fb-hourline`, the
  now-line's `top`, and every block's top and height. Changing it rescales the
  view coherently.

  For R7's backlog item 2: `.fb-gutter fb-hours` below is the hour column Day
  is supposed to reuse so the two views read as one system. If that becomes a
  shared TimeGutter component this file has to change, which makes it a
  contract change routed through R0 rather than something R7 can do inside its
  own paths.
*/
const HOUR_H = 34;

export function WeekView({ date, now, events, settings }) {
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

      <div className="fb-weekbody">
        <div className="fb-weekgrid" style={{ height: gridH }}>
          <div className="fb-gutter fb-hours">
            {hours.map((h) => (
              <span className="fb-hour" style={{ height: HOUR_H }} key={h}>
                {fmtTime(new Date(2000, 0, 1, h))}
              </span>
            ))}
          </div>

          {days.map((d, i) => {
            const today = sameDay(d, now);
            const list = events.filter((e) => sameDay(e.start, d) && !e.allDay);
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
                  return (
                    <div
                      key={e.id}
                      className="fb-wblock"
                      style={{
                        top: ((s - spanStart) / 60) * HOUR_H,
                        height: Math.max(((en - s) / 60) * HOUR_H - 2, 18),
                        background: fillFor(e),
                      }}
                    >
                      <span className="fb-wbtitle">{e.title}</span>
                      <span className="fb-wbtime">{fmtTime(e.start)}</span>
                    </div>
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
