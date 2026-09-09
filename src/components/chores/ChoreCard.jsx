import { Check } from "./icons.jsx";

/*
  One chore, in the bank or in a person's column. Two independent
  interactions live on the same card without conflicting:

    - Tap the card anywhere outside the checkbox: select it for reassignment
      (PLAN.md §R11 item 3's tap fallback — ChoresView.jsx does the actual
      reassigning when a column header is tapped next).
    - Drag the card by its native HTML5 draggable attribute onto a column.
      Deliberately native `dragstart`/`dataTransfer` rather than a
      Pointer-Events-driven custom drag: iOS Safari has never fired HTML5
      drag events from touch input, so on the iPad this app actually ships
      on, drag is inert and tap is what works — exactly the trade-off
      PLAN.md §R11 item 3 asks for ("drag alone is a poor sole interaction
      ... there must be a fallback that always works"). Desktop/trackpad
      testing gets a working drag for free; touch gets the tap path.

  Tapping the checkbox stops propagation so completing a chore never also
  selects it.

  A routine-generated instance (`routineId` set) is still draggable and
  tappable like any other chore — reassigning it only overrides *this week's*
  materialized row; the rotation scheduler computes a fresh assignee again
  next cycle regardless of any override left on an old instance (see
  rotation.js's isCurrentInstance).
*/
export function ChoreCard({ task, selected, onSelect, onToggle }) {
  return (
    <div
      className={`fb-chorecard${selected ? " is-selected" : ""}${task.done ? " is-done" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
    >
      <button
        className="fb-chorecheck"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        aria-pressed={task.done}
      >
        {task.done && <Check />}
      </button>
      <span className="fb-choreemoji2" aria-hidden="true">
        {task.emoji}
      </span>
      <span className="fb-choretitle">{task.title}</span>
      {task.routineId && (
        <span className="fb-chorerecur" title="Recurring chore" aria-label="Recurring chore">
          ↻
        </span>
      )}
    </div>
  );
}
