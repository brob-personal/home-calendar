import { sameDay, minutesInto, fmtTime } from "../../lib/date.js";
import { tint, variantColor } from "../../lib/color.js";
import { Avatar } from "../shell/Avatar.jsx";

/*
  Day — moved verbatim from family-board.jsx:765-847.

  R7 rebuilds this file. Read PLAN.md §R7 before changing anything here; what
  follows is the handoff.

  The view is rotated 90 degrees from the spec. Right now `.fb-lane` is a row
  per person, time runs left-to-right inside `.fb-lanetrack`, and the hour
  axis is a strip *underneath* the lanes. The spec wants the transpose: time
  down the vertical left axis, people across the top. That is a re-layout, not
  a CSS tweak.

  Preserve on the way through (PLAN.md §R7 item 4):
    - the all-day chip row
    - the ACCENT_NOW now-line, and its `showNow` guard — it is only drawn when
      the anchored day is today *and* the current minute falls inside the
      configured dayStart..dayEnd window
    - the empty state below, for when every member is filtered out
    - `Math.max(en - s, 22)`, which stops a short event collapsing to an
      invisible sliver

  Two things this view does that the others do not:
    - It colours blocks with `variantColor(m.color, e.variant)` per lane
      rather than with the shared `fillFor`. A shared event appears once in
      each owner's lane in that owner's own hue, so there is no diagonal split
      to draw here — the split is a Week/Month/Agenda concern. This is why
      DayView does not consume PaletteContext.
    - It receives `shownMembers`, not `members`. Deferred Defect #2 is that
      AgendaView receives the unfiltered list and this one does not.

  Deferred Defect #6 is the onDoubleClick below: it is the only delete path in
  the entire app, it is Day-view only, it is unreliable on iOS Safari, and it
  destroys an event with no confirm step. R7's item 5 replaces it with a
  tap-to-open detail sheet reachable from every view.
*/
export function DayView({ date, now, events, members, settings, onDelete }) {
  const spanStart = settings.dayStart * 60;
  const spanEnd = settings.dayEnd * 60;
  const span = Math.max(spanEnd - spanStart, 60);

  const timed = events.filter((e) => sameDay(e.start, date) && !e.allDay);
  const allDay = events.filter((e) => sameDay(e.start, date) && e.allDay);

  const ticks = [];
  for (let h = settings.dayStart; h <= settings.dayEnd; h += 2) {
    ticks.push({ h, pct: ((h * 60 - spanStart) / span) * 100 });
  }
  const showNow =
    sameDay(date, now) && minutesInto(now) >= spanStart && minutesInto(now) <= spanEnd;
  const nowPct = ((minutesInto(now) - spanStart) / span) * 100;

  if (members.length === 0) {
    return (
      <div className="fb-empty">Everyone is hidden. Tap a face below to bring a calendar back.</div>
    );
  }

  return (
    <div className="fb-day">
      {allDay.length > 0 && (
        <div className="fb-allday">
          {allDay.map((e) => (
            <span key={e.id} className="fb-alldaychip">
              {e.title}
            </span>
          ))}
        </div>
      )}

      <div className="fb-lanes">
        {members.map((m) => {
          const mine = timed.filter((e) => e.memberIds?.includes(m.id));
          return (
            <div className="fb-lane" key={m.id}>
              <div className="fb-lanename">
                <Avatar member={m} size={38} />
                <span className="fb-lanetext">{m.name}</span>
              </div>
              <div className="fb-lanetrack" style={{ background: tint(m.color, 0.88) }}>
                {showNow && <div className="fb-nowline" style={{ left: `${nowPct}%` }} />}
                {mine.length === 0 && <span className="fb-laneempty">Free</span>}
                {mine.map((e) => {
                  const s = Math.max(minutesInto(e.start), spanStart);
                  const en = Math.min(minutesInto(e.end), spanEnd);
                  const shared = (e.memberIds || []).length > 1;
                  return (
                    <button
                      key={e.id}
                      className="fb-block"
                      style={{
                        left: `${((s - spanStart) / span) * 100}%`,
                        width: `${(Math.max(en - s, 22) / span) * 100}%`,
                        background: variantColor(m.color, e.variant),
                      }}
                      onDoubleClick={() => onDelete(e.id)}
                      title="Double-tap to remove"
                    >
                      <span className="fb-blocktitle">{e.title}</span>
                      <span className="fb-blocktime">
                        {fmtTime(e.start)}
                        {shared ? " with family" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fb-axis">
        {ticks.map((t) => (
          <span key={t.h} className="fb-tick" style={{ left: `${t.pct}%` }}>
            {fmtTime(new Date(2000, 0, 1, t.h))}
          </span>
        ))}
      </div>
    </div>
  );
}
