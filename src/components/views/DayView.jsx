import { sameDay, spansDay, minutesInto, fmtTime, fmtRange } from "../../lib/date.js";
import { tint, variantColor } from "../../lib/color.js";
import { layoutOverlaps } from "../../lib/layout.js";
import { Avatar } from "../shell/Avatar.jsx";
import { TimeGutter } from "./TimeGutter.jsx";
import { SHORT_MIN, eventTier } from "../../lib/eventBox.js";

/*
  Day — rebuilt by R7 (PLAN.md §R7) from the version moved verbatim off
  family-board.jsx:765-847.

  That version was rotated 90 degrees from the spec: `.fb-lane` was a row per
  person, time ran left-to-right inside `.fb-lanetrack`, and the hour axis was
  a strip underneath. This is the transpose the spec asked for — time down the
  vertical left axis, people across the top — built on the same HOUR_H-per-hour
  grid math as WeekView (item 2), via the shared <TimeGutter>. Day and Week
  now share fb-gutter/fb-hours/fb-hour, fb-hourline, fb-nowrow/fb-nowdot, and
  the fb-wblock top/height positioning; only the per-lane colouring and the
  column grouping (by member, not by day) differ.

  Preserved (item 4):
    - the all-day chip row — now spans-aware (`spansDay`, not `sameDay(e.start,
      date)`) so a multi-day all-day event shows on every day it covers, and
      each chip is a button that opens EventDetailSheet like every other event
    - the now-line, gated on `showNow` — today *and* inside dayStart..dayEnd
    - the empty state below, for when every member is filtered out
    - the short-event floor that stops a block collapsing to an invisible
      sliver, `Math.max(en - s, 22)` — now applied to height, since height is
      what a vertical timeline collapses to
    - per-lane colouring with `variantColor(m.color, e.variant)` rather than
      the shared `fillFor`: a shared event appears once in each owner's column
      in that owner's own hue, so there is no diagonal split to draw here —
      the split is a Week/Month/Agenda concern. DayView still does not consume
      PaletteContext.
    - `shownMembers`, not `members` (Deferred Defect #2 is AgendaView's, not
      this view's)

  Item 5: the onDoubleClick delete is gone. Tapping a block calls `onSelect`,
  which App.jsx wires to the new EventDetailSheet — the app's first edit path,
  and a delete path that requires a confirm step and is reachable from every
  view instead of only this one.

  Overlap layout: two events for the same member at overlapping times used to
  stack directly on top of each other. `layoutOverlaps` (src/lib/layout.js,
  shared with WeekView) now cascades whatever is overlapping at that moment —
  fixed readable width, staggered left offset, higher z-index for later
  events — purely as left/width/zIndex on top of the existing top/height
  positioning — colouring and content are untouched.
*/
const HOUR_H = 34;

export function DayView({ date, now, events, members, settings, onSelect }) {
  const hours = [];
  for (let h = settings.dayStart; h < settings.dayEnd; h++) hours.push(h);
  const spanStart = settings.dayStart * 60;
  const spanEnd = settings.dayEnd * 60;
  const gridH = hours.length * HOUR_H;

  const timed = events.filter((e) => sameDay(e.start, date) && !e.allDay);
  const allDay = events.filter((e) => e.allDay && spansDay(e, date));

  const nowTop = ((minutesInto(now) - spanStart) / 60) * HOUR_H;
  const showNow =
    sameDay(date, now) && minutesInto(now) >= spanStart && minutesInto(now) <= spanEnd;

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
            <button key={e.id} className="fb-alldaychip" onClick={() => onSelect(e)}>
              {e.title}
            </button>
          ))}
        </div>
      )}

      <div className="fb-dayhead">
        <span className="fb-gutter" />
        {members.map((m) => (
          <div className="fb-dhead" key={m.id}>
            <Avatar member={m} size={30} />
            <span className="fb-dname">{m.name}</span>
          </div>
        ))}
      </div>

      <div className="fb-daybody">
        <div className="fb-daygrid" style={{ height: gridH }}>
          <TimeGutter hours={hours} hourH={HOUR_H} />

          {members.map((m) => {
            const mine = timed.filter((e) => e.memberIds?.includes(m.id));
            const cols = layoutOverlaps(mine);
            return (
              <div className="fb-dcol" key={m.id} style={{ background: tint(m.color, 0.88) }}>
                {hours.map((h) => (
                  <div className="fb-hourline" style={{ height: HOUR_H }} key={h} />
                ))}
                {showNow && (
                  <div className="fb-nowrow" style={{ top: nowTop }}>
                    <span className="fb-nowdot" />
                  </div>
                )}
                {mine.length === 0 && <span className="fb-laneempty">Free</span>}
                {mine.map((e) => {
                  const s = Math.max(minutesInto(e.start), spanStart);
                  const en = Math.min(minutesInto(e.end), spanEnd);
                  const shared = (e.memberIds || []).length > 1;
                  const { left, width, z } = cols.get(e);
                  const durMin = en - s;
                  const tier = eventTier(durMin);
                  const height =
                    tier === "condensed" ? (SHORT_MIN / 60) * HOUR_H : ((en - s) / 60) * HOUR_H;
                  return (
                    <button
                      key={e.id}
                      className={`fb-dblock${tier === "stacked" ? " is-stacked" : " is-compact"}`}
                      style={{
                        top: ((s - spanStart) / 60) * HOUR_H,
                        height,
                        left: `calc(${left}% + 6px)`,
                        width: `calc(${width}% - 12px)`,
                        right: "auto",
                        zIndex: z,
                        background: variantColor(m.color, e.variant),
                      }}
                      onClick={() => onSelect(e)}
                    >
                      <span className="fb-blocktitle">{e.title}</span>
                      <span className="fb-blocktime">
                        {tier === "stacked" ? fmtRange(e.start, e.end) : fmtTime(e.start)}
                        {shared ? " with family" : ""}
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
