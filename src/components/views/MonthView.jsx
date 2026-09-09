import { addDays, sameDay, startOfWeek, DOW } from "../../lib/date.js";
import { usePalette } from "../../state/PaletteContext.js";

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
*/
export function MonthView({ date, now, events, onPick }) {
  const { fillFor } = usePalette();

  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const cut = cells.findIndex((d, i) => i % 7 === 0 && d > last);
  const visible = cells.slice(0, cut > 0 ? cut : 42);

  return (
    <div className="fb-monthwrap">
      <div className="fb-monthhead">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="fb-grid" style={{ gridTemplateRows: `repeat(${visible.length / 7}, 1fr)` }}>
        {visible.map((d, i) => {
          const outside = d.getMonth() !== date.getMonth();
          const today = sameDay(d, now);
          const list = events.filter((e) => sameDay(e.start, d));
          return (
            <button
              key={i}
              className={`fb-cell${outside ? " is-outside" : ""}${today ? " is-today" : ""}`}
              onClick={() => onPick(d)}
            >
              <span className="fb-cellnum">{d.getDate()}</span>
              <span className="fb-cellevents">
                {list.slice(0, 3).map((e) => (
                  <span key={e.id} className="fb-cellev" style={{ background: fillFor(e) }}>
                    {e.title}
                  </span>
                ))}
                {list.length > 3 && <span className="fb-cellmore">{list.length - 3} more</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
