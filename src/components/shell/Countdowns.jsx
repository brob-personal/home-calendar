import { daysUntil } from "../../lib/date.js";
import { usePalette } from "../../state/PaletteContext.js";

/*
  The milestone ticker, moved from family-board.jsx:743-761.

  One change, and it is the one PLAN.md §R2 item 5 asks for: the prototype
  received `color={firstColor}` as a prop from the root. It now reads
  firstColor from PaletteContext, so the root no longer threads colour
  functions through the tree. The `items` and `now` props stay — those are
  data, not palette.

  Which milestones appear, and their cap of four, is decided in App.jsx; this
  component only renders what it is handed.
*/
export function Countdowns({ items, now }) {
  const { firstColor } = usePalette();

  return (
    <div className="fb-countdowns">
      {items.map((e) => {
        const d = daysUntil(e.start, now);
        return (
          <div className="fb-cd" key={e.id}>
            <span className="fb-cdnum" style={{ color: firstColor(e) }}>
              {d === 0 ? "Today" : d}
            </span>
            {d !== 0 && <span className="fb-cdunit">{d === 1 ? "day" : "days"}</span>}
            <span className="fb-cdlabel">{e.title}</span>
          </div>
        );
      })}
    </div>
  );
}
