import { startOfDay, addDays, sameDay, fmtTime, DOW } from "../../lib/date.js";
import { Avatar } from "../shell/Avatar.jsx";
import { usePalette } from "../../state/PaletteContext.js";

/*
  Agenda — moved from family-board.jsx:977-1030.

  One change, per PLAN.md §R2 item 5: `fill` was a prop and is now read from
  PaletteContext.

  `members` is still a prop, kept rather than pulled from context so its
  source stays visible at the call site instead of disappearing into a
  provider. Deferred Defect #2 is fixed: App.jsx now passes `shownMembers`,
  matching DayView, so filtering a person out also stops `who()` from
  rendering their avatar on a shared event.

  The grouping loop below relies on `upcoming` being sorted, which it is: the
  sort happens two lines earlier. It compares each event against only the last
  group, so an unsorted list would silently produce duplicate group headers.

  `onSelect` is R7's addition (PLAN.md §R7 item 5): each row is now a button
  that opens the EventDetailSheet. Its children were already plain spans, so
  turning the row itself into a button introduces no nested-interactive-element
  problem.

  Multi-day all-day events used to appear once, grouped under their start
  day, and drop off the list the moment that day passed even while still
  running. `relevant`/`instances` above expand such an event into one row per
  remaining day it spans (today through its inclusive `end`) before grouping,
  so a trip shows up on every day of the trip, same as Day/Week/Month.
*/
export function AgendaView({ date, now, events, members, onSelect }) {
  const { fillFor } = usePalette();

  const from = startOfDay(date);
  /* A multi-day all-day event stays relevant every day it's still running,
     not only on the day it started — `e.start >= from` alone would drop a
     trip already underway off the agenda the moment its first day passes. */
  const relevant = events.filter((e) => (e.allDay ? e.end >= from : e.start >= from));

  const instances = [];
  relevant.forEach((e) => {
    if (!e.allDay) {
      instances.push({ day: e.start, event: e });
      return;
    }
    const last = startOfDay(e.end);
    const first = startOfDay(e.start) < from ? from : startOfDay(e.start);
    for (let d = first; d <= last; d = addDays(d, 1)) instances.push({ day: d, event: e });
  });
  instances.sort((a, b) => a.day - b.day || a.event.start - b.event.start);
  const upcoming = instances.slice(0, 40);

  const groups = [];
  upcoming.forEach(({ day, event: e }) => {
    const last = groups[groups.length - 1];
    if (last && sameDay(last.day, day)) last.items.push(e);
    else groups.push({ day, items: [e] });
  });

  const who = (e) =>
    (e.memberIds || []).map((id) => members.find((m) => m.id === id)).filter(Boolean);

  if (groups.length === 0) {
    return (
      <div className="fb-empty">
        Nothing scheduled from here on. Tap New event to add something.
      </div>
    );
  }

  return (
    <div className="fb-agenda">
      {groups.map((g, i) => (
        <div className="fb-agroup" key={i}>
          <div className="fb-aday">
            <span className="fb-adow">{sameDay(g.day, now) ? "Today" : DOW[g.day.getDay()]}</span>
            <span className="fb-anum">{g.day.getDate()}</span>
          </div>
          <div className="fb-alist">
            {g.items.map((e) => (
              <button className="fb-arow" key={e.id} onClick={() => onSelect(e)}>
                <span className="fb-abar" style={{ background: fillFor(e) }} />
                <span className="fb-atime">{e.allDay ? "All day" : fmtTime(e.start)}</span>
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
        </div>
      ))}
    </div>
  );
}
