import { startOfDay, sameDay, fmtTime, DOW } from "../../lib/date.js";
import { Avatar } from "../shell/Avatar.jsx";
import { usePalette } from "../../state/PaletteContext.js";

/*
  Agenda — moved from family-board.jsx:977-1030.

  One change, per PLAN.md §R2 item 5: `fill` was a prop and is now read from
  PaletteContext.

  `members` is still a prop, and it is still the *unfiltered* roster. That is
  Deferred Defect #2, assigned to R12: DayView is handed `shownMembers` while
  this view is handed `members`, so filtering a person out removes their
  events from the list — `events` is already filtered upstream — but `who()`
  will still happily render an avatar for a hidden person on a shared event.
  Fixing it is a one-word change at the call site in App.jsx and R2 may not
  make it. Kept as a prop rather than pulled from context so the leak stays
  visible at that call site instead of disappearing into a provider.

  The grouping loop below relies on `upcoming` being sorted, which it is: the
  sort happens two lines earlier. It compares each event against only the last
  group, so an unsorted list would silently produce duplicate group headers.

  `onSelect` is R7's addition (PLAN.md §R7 item 5): each row is now a button
  that opens the EventDetailSheet. Its children were already plain spans, so
  turning the row itself into a button introduces no nested-interactive-element
  problem.
*/
export function AgendaView({ date, now, events, members, onSelect }) {
  const { fillFor } = usePalette();

  const from = startOfDay(date);
  const upcoming = events
    .filter((e) => e.start >= from)
    .sort((a, b) => a.start - b.start)
    .slice(0, 40);

  const groups = [];
  upcoming.forEach((e) => {
    const last = groups[groups.length - 1];
    if (last && sameDay(last.day, e.start)) last.items.push(e);
    else groups.push({ day: e.start, items: [e] });
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
