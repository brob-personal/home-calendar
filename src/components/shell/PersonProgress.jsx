import { sameDay } from "../../lib/date.js";

/*
  Small, subtle "how much of today is done" indicator for one member —
  computed purely from event end times against `now`, no completed/done
  flag on the event itself. Always reads today (`now`), not whatever day
  Day/Week happen to be paged to, same asymmetry Header's own "N today"
  line already relies on.

  Renders nothing when the member has no timed events today, so an empty
  day doesn't show a misleading "0/0" bar.
*/
export function PersonProgress({ member, events, now }) {
  const mine = events.filter(
    (e) => !e.allDay && sameDay(e.start, now) && (e.memberIds || []).includes(member.id),
  );
  if (mine.length === 0) return null;

  const done = mine.filter((e) => e.end <= now).length;
  const pct = Math.round((done / mine.length) * 100);

  return (
    <span className="fb-pprog" title={`${done} of ${mine.length} done today`}>
      <span className="fb-pprogtrack">
        <span className="fb-pprogfill" style={{ width: `${pct}%`, background: member.color }} />
      </span>
      <span className="fb-pprogfrac">
        {done}/{mine.length}
      </span>
    </span>
  );
}
