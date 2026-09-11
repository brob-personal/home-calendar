import { fmtRange, fmtTime } from "../../lib/date.js";
import { Avatar } from "../shell/Avatar.jsx";
import { Sheet } from "../shell/Sheet.jsx";

/*
  What a Day/Week "+N" chip opens: the full list of events in one crowded
  time slot, for the case where more events overlap than there is readable
  column width to show them side by side (src/lib/layout.js).

  It is the same modal <Sheet> MonthView's WeatherDaySheet and R7's
  EventDetailSheet use, and the rows are AgendaView's `.fb-arow` idiom —
  colour bar, time, title, faces — rather than a new list style, so a
  crowded slot reads like the agenda the board already has. Every row is a
  button onto the same `onSelect` a block tap uses, so the chip is a detour
  to EventDetailSheet rather than a dead end.

  `slot.events` is the whole slot, not only `slot.hidden` — the chip says
  "+2" because two events lost their column, but the useful thing to show
  once it is open is everything happening in that range, in start order.
*/
export function SlotOverflowSheet({ slot, members, timeFormat, colorFor, onSelect, onClose }) {
  const who = (e) =>
    (e.memberIds || []).map((id) => (members || []).find((m) => m.id === id)).filter(Boolean);

  return (
    <Sheet title={fmtRange(slot.start, slot.end, timeFormat)} onClose={onClose}>
      <div className="fb-alist">
        {slot.events.map((e) => (
          <button className="fb-arow" key={e.id} onClick={() => onSelect(e)}>
            <span className="fb-abar" style={{ background: colorFor(e) }} />
            <span className="fb-atime">{e.allDay ? "All day" : fmtTime(e.start, timeFormat)}</span>
            <span className="fb-atitle">{e.title}</span>
            {e.location && <span className="fb-awhere">{e.location}</span>}
            <span className="fb-awho">
              {who(e).map((m) => (
                <Avatar key={m.id} member={m} size={26} />
              ))}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
