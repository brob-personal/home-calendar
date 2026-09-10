import { useState } from "react";

import { fmtTime, startOfDay, addDays } from "../../lib/date.js";
import { tint, splitFill, variantColor, VARIATION_COUNT } from "../../lib/color.js";
import { Avatar } from "../shell/Avatar.jsx";
import { Sheet } from "../shell/Sheet.jsx";
import { Field } from "../shell/Field.jsx";

/*
  PLAN.md §R7 item 5 — the app's first edit path and its only delete path
  reachable from every view. Replaces DayView's onDoubleClick, which was
  Day-only, unreliable on iOS Safari, and destroyed an event with no confirm
  step (Deferred Defect #6).

  Built on the same fields Composer uses (title, who, shade, start hour,
  duration, location, milestone) so an edited event stays indistinguishable
  from a freshly authored one — same VARIATIONS ramp, same splitFill preview.
  Unlike Composer this never moves an event to a different day; that's outside
  what replacing a delete-only path needs, and out of scope for R7.

  Delete is a two-step confirm rather than the old double-tap: tapping Delete
  swaps the footer for an explicit Cancel / Yes, delete pair instead of
  overloading a second tap on the same control.

  "All day" is now editable independently of "Count down to this", matching
  Composer — an event created (or synced from Google) as a plain multi-day
  all-day event can be toggled and its span adjusted here, not just at
  creation. "Ends" is an offset in days from the event's own (unmoved) start
  day rather than an absolute date, consistent with "this never moves an
  event to a different day" above — only the span, not the start, is
  editable. A milestone stays single-day.
*/
export function EventDetailSheet({ event, members, settings, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(event.title);
  const [who, setWho] = useState(event.memberIds || []);
  const [variant, setVariant] = useState(event.variant ?? 0);
  const [hour, setHour] = useState(event.start.getHours());
  const [dur, setDur] = useState(Math.round((event.end - event.start) / 60000) || 60);
  const [allDay, setAllDay] = useState(Boolean(event.allDay));
  const [endOffset, setEndOffset] = useState(() =>
    Math.min(6, Math.max(0, Math.round((startOfDay(event.end) - startOfDay(event.start)) / 86400000))),
  );
  const [milestone, setMilestone] = useState(Boolean(event.milestone));
  const [location, setLocation] = useState(event.location || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAllDay = allDay || milestone;
  const toggle = (id) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const chosen = who.map((id) => members.find((m) => m.id === id)).filter(Boolean);
  const preview = splitFill(
    chosen.map((m) => variantColor(m.color, variant)),
    "var(--surface)",
  );

  const save = () => {
    if (!title.trim()) return;
    let start, end;
    if (isAllDay) {
      start = startOfDay(event.start);
      end = addDays(start, milestone ? 0 : endOffset);
    } else {
      start = new Date(event.start);
      start.setHours(hour, 0, 0, 0);
      end = new Date(start.getTime() + dur * 60000);
    }
    onSave({
      title: title.trim(),
      memberIds: who,
      variant,
      start,
      end,
      allDay: isAllDay,
      milestone,
      location: location.trim(),
    });
  };

  const hours = [];
  for (let h = settings.dayStart; h <= settings.dayEnd; h++) hours.push(h);

  return (
    <Sheet title="Event" onClose={onClose}>
      <div className="fb-preview" style={{ background: preview }}>
        {title || "Event"}
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
          {members.map((m) => (
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
              <Avatar member={m} size={28} />
              {m.name}
            </button>
          ))}
        </div>
      </Field>

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

      {!milestone && (
        <label className="fb-check">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>All day</span>
        </label>
      )}

      {allDay && !milestone && (
        <Field label="Ends">
          <div className="fb-pills">
            {Array.from({ length: 7 }, (_, i) => (
              <button
                key={i}
                className={`fb-pill${endOffset === i ? " is-on" : ""}`}
                onClick={() => setEndOffset(i)}
              >
                {i === 0 ? "Same day" : `+${i} day${i > 1 ? "s" : ""}`}
              </button>
            ))}
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
        {confirmDelete ? (
          <>
            <span className="fb-inlabel fb-deleteprompt">Delete this event?</span>
            <button className="fb-ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button className="fb-primary fb-danger" onClick={onDelete}>
              Yes, delete
            </button>
          </>
        ) : (
          <>
            <button className="fb-ghost fb-textdanger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
            <button className="fb-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="fb-primary" disabled={!title.trim()} onClick={save}>
              Save
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
