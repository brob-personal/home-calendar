import { useState } from "react";

import { startOfDay } from "../../lib/date.js";
import { tint } from "../../lib/color.js";
import { Avatar } from "../shell/Avatar.jsx";
import { Sheet } from "../shell/Sheet.jsx";
import { Field } from "../shell/Field.jsx";
import { EMOJI_CHOICES } from "./constants.js";

/*
  Authors a Routine (PLAN.md §R11 item 7). There is no Settings section for
  this role to put it in — src/components/chores/** is the only path R11
  owns — so the "+ Routine" affordance and this form both live inside the
  chores tab itself, the same "everything configured where you use it"
  approach the rest of the board's "not building onboarding" decision
  already implies.

  `anchor` is stamped as today at save time and never exposed as a field:
  PLAN.md §R11 item 7 asks for rotation to be a pure function of the rule and
  the date, and the rule only needs *a* stable anchor week, not an
  author-chosen one — today is as good as any and one fewer decision an
  operator has to make on a board with no onboarding.
*/
export function RoutineForm({ members, mode, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [kind, setKind] = useState("rotating");
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? null);
  const [group, setGroup] = useState(members.map((m) => m.id));
  const [everyN, setEveryN] = useState(1);

  const toggleGroup = (id) =>
    setGroup((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  const canSave = Boolean(title.trim()) && (kind === "fixed" ? Boolean(assigneeId) : group.length > 0);

  const save = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      emoji,
      kind,
      assigneeId: kind === "fixed" ? assigneeId : null,
      memberIds: kind === "rotating" ? group : [],
      everyN,
      anchor: startOfDay(new Date()),
      mode,
    });
  };

  return (
    <Sheet title="New routine" onClose={onClose}>
      <input
        className="fb-input fb-input-lg"
        placeholder="What's the chore?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <Field label="Emoji">
        <div className="fb-choreemoji">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              type="button"
              className={`fb-choreemojibtn${emoji === e ? " is-on" : ""}`}
              onClick={() => setEmoji(e)}
              aria-label={`Emoji ${e}`}
              aria-pressed={emoji === e}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Kind">
        <div className="fb-pills">
          <button
            className={`fb-pill${kind === "fixed" ? " is-on" : ""}`}
            onClick={() => setKind("fixed")}
          >
            One person
          </button>
          <button
            className={`fb-pill${kind === "rotating" ? " is-on" : ""}`}
            onClick={() => setKind("rotating")}
          >
            Rotates
          </button>
        </div>
      </Field>

      {kind === "fixed" ? (
        <Field label="Who">
          <div className="fb-pills">
            {members.map((m) => (
              <button
                key={m.id}
                className={`fb-avpill${assigneeId === m.id ? " is-on" : ""}`}
                style={
                  assigneeId === m.id
                    ? { background: tint(m.color, 0.74), borderColor: m.color }
                    : undefined
                }
                onClick={() => setAssigneeId(m.id)}
              >
                <Avatar member={m} size={28} />
                {m.name}
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <Field label="Rotates among">
          <div className="fb-pills">
            {members.map((m) => (
              <button
                key={m.id}
                className={`fb-avpill${group.includes(m.id) ? " is-on" : ""}`}
                style={
                  group.includes(m.id)
                    ? { background: tint(m.color, 0.74), borderColor: m.color }
                    : undefined
                }
                onClick={() => toggleGroup(m.id)}
              >
                <Avatar member={m} size={28} />
                {m.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Every">
        <div className="fb-pills">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              className={`fb-pill${everyN === n ? " is-on" : ""}`}
              onClick={() => setEveryN(n)}
            >
              {n === 1 ? "Week" : `${n} weeks`}
            </button>
          ))}
        </div>
      </Field>

      <div className="fb-sheetfoot">
        <button className="fb-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="fb-primary" disabled={!canSave} onClick={save}>
          Add routine
        </button>
      </div>
    </Sheet>
  );
}
