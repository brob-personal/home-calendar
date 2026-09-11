import { useState } from "react";

import { startOfDay, addDays, sameDay, minutesInto } from "../../lib/date.js";
import { tint, splitFill, variantColor, VARIATION_COUNT } from "../../lib/color.js";
import { useMode } from "../../state/ModeContext.js";
import { Avatar } from "../shell/Avatar.jsx";
import { Field } from "../shell/Field.jsx";
import { DateField } from "../shell/DateField.jsx";
import { TimeField } from "../shell/TimeField.jsx";
import { Clock, Person, Pin, Notebook } from "../shell/icons.jsx";

/*
  Splits an Event-shaped `initial` into the timing row's own state currency:
  a calendar-day `startDate`/`endDate` pair plus minutes-since-midnight for
  each. An all-day event carries no meaningful time of day, so it gets a
  fixed 9am-10am default rather than the misleading midnight
  `event.start.getHours()` would otherwise produce if "All day" is later
  unchecked.

  `endDateTouched` seeds `true` for an event that is already multi-day, so
  loading an existing multi-day event into the form doesn't immediately
  auto-collapse its span the first time a time field re-renders.
*/
export function deriveTimingState(initial) {
  const startDate = startOfDay(initial.start);
  const endDate = startOfDay(initial.end);
  return {
    startDate,
    startMinutes: initial.allDay ? 9 * 60 : minutesInto(initial.start),
    endDate,
    endMinutes: initial.allDay ? 10 * 60 : minutesInto(initial.end),
    endDateTouched: !sameDay(startDate, endDate),
  };
}

function wontSyncReason(calendars, memberId) {
  const cal = calendars.find((c) => c.memberIds.length === 1 && c.memberIds[0] === memberId);
  if (!cal) return "no calendar linked";
  if (cal.accessRole !== "writer" && cal.accessRole !== "owner") return "you only have view access";
  return null;
}

function atMinutes(date, minutes) {
  const d = new Date(date);
  d.setHours(0, minutes, 0, 0);
  return d;
}

export function EventForm({ initial, members, settings, placeholderTitle, renderFooter }) {
  const { calendars } = useMode();

  const [title, setTitle] = useState(initial.title);
  const [who, setWho] = useState(initial.memberIds || []);
  const [variant, setVariant] = useState(initial.variant ?? 0);
  const [location, setLocation] = useState(initial.location || "");
  const [description, setDescription] = useState(initial.description || "");
  const [allDay, setAllDay] = useState(Boolean(initial.allDay))
  const [milestone, setMilestone] = useState(Boolean(initial.milestone));

  const timing0 = deriveTimingState(initial);
  const [startDate, setStartDate] = useState(timing0.startDate);
  const [startMinutes, setStartMinutes] = useState(timing0.startMinutes);
  const [endDate, setEndDate] = useState(timing0.endDate);
  const [endMinutes, setEndMinutes] = useState(timing0.endMinutes);
  const [endDateTouched, setEndDateTouched] = useState(timing0.endDateTouched);

  /*
    The multi-day auto-detect/auto-collapse rule (spec §4): while the user
    has never explicitly opened the end-date popover, any end time at or
    before the start time reads as "the next day", and any end time after
    the start time collapses back to a single day. Once the end-date popover
    has been used directly, this stops overriding it — see applyEndDate.
  */
  const applyStartMinutes = (next) => {
    setStartMinutes(next);
    if (!endDateTouched) setEndDate(endMinutes <= next ? addDays(startDate, 1) : startDate);
  };

  const applyEndMinutes = (next) => {
    setEndMinutes(next);
    if (!endDateTouched) setEndDate(next <= startMinutes ? addDays(startDate, 1) : startDate);
  };

  const applyStartDate = (next) => {
    setStartDate(next);
    if (endDateTouched) {
      setEndDate((d) => (d < next ? next : d));
    } else {
      setEndDate(endMinutes <= startMinutes ? addDays(next, 1) : next);
    }
  };

  const applyEndDate = (next) => {
    setEndDate(next);
    setEndDateTouched(true);
  };

  const applyMilestone = (checked) => {
    setMilestone(checked);
    if (checked) {
      setAllDay(true);
      setEndDate(startDate);
      setEndDateTouched(false);
    }
  };

  const isAllDay = allDay || milestone;
  const showEndDate = !milestone && (endDateTouched || !sameDay(startDate, endDate));

  const toggle = (id) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const chosen = who.map((id) => members.find((m) => m.id === id)).filter(Boolean);
  const unsynced = chosen
    .map((m) => ({ member: m, reason: wontSyncReason(calendars, m.id) }))
    .filter((x) => x.reason);
  const preview = splitFill(
    chosen.map((m) => variantColor(m.color, variant)),
    "var(--surface)",
  );

  const draftStart = isAllDay ? startOfDay(startDate) : atMinutes(startDate, startMinutes);
  /*
    Safety net, not a design change: applyStartDate/applyEndDate correctly
    clamp endDate relative to startDate, but neither reconciles endMinutes
    against startMinutes once the two dates land on the same day (e.g. an
    explicit end-date pick back onto the start day, or a start-date move
    that catches up to a touched end date). Rather than reject that
    end-before-start combination, bump end forward one day here — the same
    "silently repair" philosophy schema.js's normalizeEvent already applies
    to an end-before-start event, just one day forward instead of clamped
    to zero-length, since a zero-length event isn't meaningful here either.
  */
  let draftEnd = isAllDay ? startOfDay(milestone ? startDate : endDate) : atMinutes(endDate, endMinutes);
  if (!isAllDay && draftEnd <= draftStart) draftEnd = addDays(draftEnd, 1);

  const draft = {
    title: title.trim(),
    memberIds: who,
    variant,
    start: draftStart,
    end: draftEnd,
    allDay: isAllDay,
    milestone,
    location: location.trim(),
    description: description.trim(),
  };
  const canSave = Boolean(title.trim());

  return (
    <>
      <div className="fb-preview" style={{ background: preview }}>
        {title || placeholderTitle}
      </div>

      <input
        className="fb-input fb-input-lg"
        placeholder="Add title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <div className="fb-timingblock">
        <div className="fb-timingrow">
          <Clock />
          <DateField value={startDate} onChange={applyStartDate} ariaLabel="Event date" />
          {!isAllDay && (
            <>
              <TimeField
                minutes={startMinutes}
                onChange={applyStartMinutes}
                timeFormat={settings.timeFormat}
                ariaLabel="Start time"
              />
              <span className="fb-timingdash">–</span>
              <TimeField
                minutes={endMinutes}
                onChange={applyEndMinutes}
                timeFormat={settings.timeFormat}
                durationFrom={startMinutes}
                ariaLabel="End time"
              />
            </>
          )}
        </div>
        {showEndDate && (
          <div className="fb-timingend">
            <span className="fb-inlabel">Ends</span>
            <DateField value={endDate} onChange={applyEndDate} minDate={startDate} ariaLabel="End date" />
          </div>
        )}
      </div>

      <label className="fb-check">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        <span>All day</span>
      </label>

      <label className="fb-check">
        <input
          type="checkbox"
          checked={milestone}
          onChange={(e) => applyMilestone(e.target.checked)}
        />
        <span>Count down to this on the board</span>
      </label>

      <Field label="">
        <div className="fb-iconrow">
          <Person />
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

      <div className="fb-iconrow">
        <Pin />
        <input
          className="fb-input"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="fb-iconrow fb-iconrow-top">
        <Notebook />
        <textarea
          className="fb-input fb-textarea"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {renderFooter(draft, canSave)}
    </>
  );
}
