import { useState } from "react";

import { startOfDay, addDays, fmtTime, DOW } from "../../lib/date.js";
import { tint, splitFill, variantColor, VARIATION_COUNT } from "../../lib/color.js";
import { useMode } from "../../state/ModeContext.js";
import { Avatar } from "../shell/Avatar.jsx";
import { Sheet } from "../shell/Sheet.jsx";
import { Field } from "../shell/Field.jsx";

/*
  A member's own calendar — the CalendarLink whose only owner is them, same
  definition google.js's write path and Settings.jsx's memberCalendarId()
  both use. Absent, or anything short of writer/owner, means create() will
  skip that member entirely; this is what lets Composer say so before save
  instead of after.
*/
function wontSyncReason(calendars, memberId) {
  const cal = calendars.find((c) => c.memberIds.length === 1 && c.memberIds[0] === memberId);
  if (!cal) return "no calendar linked";
  if (cal.accessRole !== "writer" && cal.accessRole !== "owner") return "you only have view access";
  return null;
}

/*
  New-event composer. Moved verbatim from family-board.jsx:1300-1436.

  It builds a draft and hands it to `onSave`; it does not know about the
  source. The "Shade" ramp is the authoring end of the sub-colour rule — the
  eleven swatches are `variantColor(member, 0..10)`, the same eleven shades
  Google's colorIds 1-11 land on, so a hand-made event and a synced one are
  indistinguishable by construction.

  Ticking "Count down to this" sets both `milestone` and `allDay`, which is
  why the Starts/For fields disappear: a countdown is a date, not a time. This
  is the only place milestones can be authored.

  Deferred Defect #4, fixed: the hour picker used to be hardcoded to 6am-10pm
  — `Array.from({ length: 17 }, (_, i) => i + 6)` — and ignored
  settings.dayStart / dayEnd entirely, so setting the board to show 5am left
  you unable to create a 5am event. `hours` below now walks
  `[dayStart, dayEnd)`, the same half-open range DayView and WeekView already
  loop over for their own hour gutters, so the picker can only ever offer a
  time the grid can actually show.

  There is no edit path anywhere in the app; this composer only creates. R3's
  backlog item 5 adds `update` to the source interface and R7's item 5 adds
  the detail sheet that would use it.

  "All day" is now its own checkbox, independent of "Count down to this" —
  previously `allDay` only ever became true as a side effect of milestone,
  so there was no way to author a plain all-day event (a holiday, a day off)
  without it also being a countdown. Checking it hides Starts/For, same as
  milestone, and reveals "Ends": a second day-pill row (Deferred Defect #15's
  fix) so a multi-day event — a vacation, a multi-day trip — gets a real end
  date instead of the old `start + dur` stub, which no view read but which
  would have shipped to Google as a landmine once R8's write-back sent it. A
  milestone stays single-day (a countdown targets one date), so "Ends" only
  shows when "All day" is checked without "Count down to this".
*/
export function Composer({ members, date, settings, onSave, onClose }) {
  const { calendars } = useMode();
  const dayStart = settings.dayStart;
  const dayEnd = settings.dayEnd;
  const hours = [];
  for (let h = dayStart; h < dayEnd; h++) hours.push(h);

  const [title, setTitle] = useState("");
  const [who, setWho] = useState([members[0]?.id].filter(Boolean));
  const [day, setDay] = useState(0);
  const [endDay, setEndDay] = useState(0);
  const [hour, setHour] = useState(() => Math.min(Math.max(18, dayStart), dayEnd - 1));
  const [dur, setDur] = useState(60);
  const [variant, setVariant] = useState(0);
  const [allDay, setAllDay] = useState(false);
  const [milestone, setMilestone] = useState(false);
  const [location, setLocation] = useState("");

  const isAllDay = allDay || milestone;
  const base = addDays(startOfDay(date), day);
  const start = new Date(base);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + dur * 60000);
  const allDayEnd = addDays(startOfDay(date), milestone ? day : endDay);

  const toggle = (id) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const chosen = who.map((id) => members.find((m) => m.id === id)).filter(Boolean);
  const unsynced = chosen
    .map((m) => ({ member: m, reason: wontSyncReason(calendars, m.id) }))
    .filter((x) => x.reason);
  const preview = splitFill(
    chosen.map((m) => variantColor(m.color, variant)),
    "var(--surface)",
  );

  return (
    <Sheet title="New event" onClose={onClose}>
      <div className="fb-preview" style={{ background: preview }}>
        {title || "New event"}
      </div>

      <input
        className="fb-input fb-input-lg"
        placeholder="What is it?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <Field label="Who">
        <div className="fb-pills">
          {members.map((m) => {
            const reason = who.includes(m.id) ? wontSyncReason(calendars, m.id) : null;
            return (
              <button
                key={m.id}
                className={`fb-avpill${who.includes(m.id) ? " is-on" : ""}`}
                style={
                  who.includes(m.id)
                    ? { background: tint(m.color, 0.74), borderColor: m.color }
                    : undefined
                }
                onClick={() => toggle(m.id)}
              >
                <span className="fb-avpill-avatar">
                  <Avatar member={m} size={28} />
                  {reason && (
                    <span className="fb-avpill-warn" title={`Won't sync — ${reason}`} aria-hidden="true">
                      !
                    </span>
                  )}
                </span>
                {m.name}
              </button>
            );
          })}
        </div>
      </Field>

      {unsynced.length > 0 && (
        <p className="fb-note fb-textwarn">
          {unsynced
            .map(({ member, reason }) => `Won't be added to ${member.name}'s calendar — ${reason}.`)
            .join(" ")}
        </p>
      )}

      {chosen.length > 0 && (
        <Field label="Shade">
          <div className="fb-ramp">
            {Array.from({ length: VARIATION_COUNT }, (_, i) => (
              <button
                key={i}
                className={`fb-shade${variant === i ? " is-on" : ""}`}
                style={{
                  background: splitFill(
                    chosen.map((m) => variantColor(m.color, i)),
                    "var(--surface)",
                  ),
                }}
                onClick={() => setVariant(i)}
                aria-label={`Shade ${i + 1}`}
              />
            ))}
          </div>
        </Field>
      )}

      <Field label="Day">
        <div className="fb-pills">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(startOfDay(date), i);
            return (
              <button
                key={i}
                className={`fb-pill${day === i ? " is-on" : ""}`}
                onClick={() => {
                  setDay(i);
                  setEndDay((e) => Math.max(e, i));
                }}
              >
                {i === 0 ? "That day" : `${DOW[d.getDay()]} ${d.getDate()}`}
              </button>
            );
          })}
        </div>
      </Field>

      <label className="fb-check">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        <span>All day</span>
      </label>

      {allDay && !milestone && (
        <Field label="Ends">
          <div className="fb-pills">
            {Array.from({ length: 7 - day }, (_, k) => {
              const i = day + k;
              const d = addDays(startOfDay(date), i);
              return (
                <button
                  key={i}
                  className={`fb-pill${endDay === i ? " is-on" : ""}`}
                  onClick={() => setEndDay(i)}
                >
                  {i === day ? "Same day" : `${DOW[d.getDay()]} ${d.getDate()}`}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {!isAllDay && (
        <>
          <Field label="Starts">
            <div className="fb-pills fb-pills-scroll">
              {hours.map((h) => (
                <button
                  key={h}
                  className={`fb-pill${hour === h ? " is-on" : ""}`}
                  onClick={() => setHour(h)}
                >
                  {fmtTime(new Date(2000, 0, 1, h))}
                </button>
              ))}
            </div>
          </Field>
          <Field label="For">
            <div className="fb-pills">
              {[30, 60, 90, 120, 180, 240].map((d) => (
                <button
                  key={d}
                  className={`fb-pill${dur === d ? " is-on" : ""}`}
                  onClick={() => setDur(d)}
                >
                  {d < 60 ? `${d}m` : `${d / 60}h`}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}

      <input
        className="fb-input"
        placeholder="Where (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <label className="fb-check">
        <input
          type="checkbox"
          checked={milestone}
          onChange={(e) => setMilestone(e.target.checked)}
        />
        <span>Count down to this on the board</span>
      </label>

      <div className="fb-sheetfoot">
        <button className="fb-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="fb-primary"
          disabled={!title.trim()}
          onClick={() =>
            title.trim() &&
            onSave({
              title: title.trim(),
              memberIds: who,
              variant,
              start: isAllDay ? base : start,
              end: isAllDay ? allDayEnd : end,
              allDay: isAllDay,
              milestone,
              location: location.trim(),
            })
          }
        >
          Add event
        </button>
      </div>
    </Sheet>
  );
}
