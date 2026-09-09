import { useState } from "react";

import { startOfDay, addDays, fmtTime, DOW } from "../../lib/date.js";
import { tint, splitFill, variantColor, VARIATION_COUNT } from "../../lib/color.js";
import { Avatar } from "../shell/Avatar.jsx";
import { Sheet } from "../shell/Sheet.jsx";
import { Field } from "../shell/Field.jsx";

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
*/
export function Composer({ members, date, settings, onSave, onClose }) {
  const dayStart = settings.dayStart;
  const dayEnd = settings.dayEnd;
  const hours = [];
  for (let h = dayStart; h < dayEnd; h++) hours.push(h);

  const [title, setTitle] = useState("");
  const [who, setWho] = useState([members[0]?.id].filter(Boolean));
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(() => Math.min(Math.max(18, dayStart), dayEnd - 1));
  const [dur, setDur] = useState(60);
  const [variant, setVariant] = useState(0);
  const [milestone, setMilestone] = useState(false);
  const [location, setLocation] = useState("");

  const base = addDays(startOfDay(date), day);
  const start = new Date(base);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + dur * 60000);

  const toggle = (id) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const chosen = who.map((id) => members.find((m) => m.id === id)).filter(Boolean);
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

      <Field label="Day">
        <div className="fb-pills">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(startOfDay(date), i);
            return (
              <button
                key={i}
                className={`fb-pill${day === i ? " is-on" : ""}`}
                onClick={() => setDay(i)}
              >
                {i === 0 ? "That day" : `${DOW[d.getDay()]} ${d.getDate()}`}
              </button>
            );
          })}
        </div>
      </Field>

      {!milestone && (
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
              start,
              end,
              allDay: milestone,
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
