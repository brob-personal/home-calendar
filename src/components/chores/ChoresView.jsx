import { useEffect, useMemo, useState } from "react";

import { startOfWeek, dayKey } from "../../lib/date.js";
import { useBoard } from "../../state/BoardContext.js";
import { useMode } from "../../state/ModeContext.js";
import { useNow } from "../../hooks/useNow.js";
import { Avatar } from "../shell/Avatar.jsx";
import { isActiveCycle, materializedTask, isCurrentInstance } from "./rotation.js";
import { ChoreCard } from "./ChoreCard.jsx";
import { RoutineForm } from "./RoutineForm.jsx";
import { ChoresStyles } from "./ChoresStyles.jsx";
import { EMOJI_CHOICES } from "./constants.js";
import { Plus } from "./icons.jsx";

/*
  ============================================================================
  CHORES / TO-DO — R11
  ----------------------------------------------------------------------------
  PLAN.md §R11: chore bank down the left, per-person columns headed by name
  and avatar, assignment by drag and by tap, tap-to-complete sinking
  completed chores to the bottom, a seeded default list, and routines.

  Reads `members`/`tasks`/`routines` and their mutators off BoardContext
  (CONTRACTS.md's own note: "R11 the chores tab needs members and the
  Task/Routine slices") and `roster`/`mode` off ModeContext — no props from
  App.jsx at all, which is why the App.jsx call site is a bare
  `<ChoresView />`. `now` is this component's own useNow() rather than a prop
  threaded from App, the same self-contained pattern R6's WeatherWidget uses
  for its own clock — the only thing this component needs `now` for is
  deciding which week it is, so a minute-granularity tick is enough.

  Tap-to-assign, the interaction PLAN.md §R11 item 3 calls the required
  fallback: tap a card to select it, then tap a column header (Bank or a
  person) to move it there; tap the same card again to cancel. Drag is native
  HTML5 drag-and-drop, documented on ChoreCard.jsx as a desktop-only bonus —
  it never fires from iOS Safari touch input, which is exactly why tap has to
  be the interaction that always works.
  ============================================================================
*/
export function ChoresView() {
  const {
    members,
    tasks,
    routines,
    addTask,
    updateTask,
    toggleTask,
    ensureRoutineTask,
    addRoutine,
  } = useBoard();
  const { roster, mode } = useMode();
  const now = useNow(60000);
  const weekKey = dayKey(startOfWeek(now));

  /*
    Materialize this week's instance of every active routine. `weekKey`
    stands in for `now` in the dependency list so this only re-runs at a
    week boundary rather than on every one-minute tick; ensureRoutineTask is
    itself idempotent (useBoardData.js), so re-running it for an
    already-materialized week is a no-op, not a duplicate.
  */
  useEffect(() => {
    for (const routine of routines) {
      if (routine.mode !== mode) continue;
      if (!isActiveCycle(routine, now)) continue;
      ensureRoutineTask(materializedTask(routine, now));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routines, weekKey, mode, ensureRoutineTask]);

  /*
    Only this mode's chores, and only the current week's routine instances —
    a prior week's completed-or-not row for a routine stays in storage
    (nothing deletes it) but is never rendered once its week has passed.
  */
  const visible = useMemo(
    () => tasks.filter((t) => t.mode === mode && isCurrentInstance(t, now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, mode, weekKey],
  );

  const bank = visible.filter((t) => !t.assigneeId);
  const columnFor = (id) => visible.filter((t) => t.assigneeId === id);

  const [selectedId, setSelectedId] = useState(null);
  const selectCard = (id) => setSelectedId((cur) => (cur === id ? null : id));

  const assign = (id, assigneeId) => {
    updateTask(id, { assigneeId });
    setSelectedId(null);
  };

  const allowDrop = (e) => e.preventDefault();
  const dropOn = (assigneeId) => (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) assign(id, assigneeId);
  };

  const [addingRoutine, setAddingRoutine] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftEmoji, setDraftEmoji] = useState(EMOJI_CHOICES[0]);

  const submitChore = () => {
    if (!draftTitle.trim()) return;
    addTask({ title: draftTitle.trim(), emoji: draftEmoji, mode });
    setDraftTitle("");
  };

  return (
    <div className="fb-chores">
      <ChoresStyles />

      <div
        className={`fb-chorebank${selectedId ? " is-dropready" : ""}`}
        onDragOver={allowDrop}
        onDrop={dropOn(null)}
      >
        <button
          type="button"
          className="fb-chorecolhead fb-chorebankhead"
          onClick={() => selectedId && assign(selectedId, null)}
        >
          Bank
        </button>

        <div className="fb-chorelist">
          {bank.length === 0 && <div className="fb-choreempty">All chores assigned.</div>}
          {sortTasks(bank).map((t) => (
            <ChoreCard
              key={t.id}
              task={t}
              selected={selectedId === t.id}
              onSelect={() => selectCard(t.id)}
              onToggle={() => toggleTask(t.id)}
            />
          ))}
        </div>

        <div className="fb-choreadd">
          <div className="fb-choreemoji">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                className={`fb-choreemojibtn${draftEmoji === e ? " is-on" : ""}`}
                onClick={() => setDraftEmoji(e)}
                aria-label={`Emoji ${e}`}
                aria-pressed={draftEmoji === e}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="fb-choreaddrow">
            <input
              className="fb-input"
              placeholder="Add a chore"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitChore()}
            />
            <button
              type="button"
              className="fb-icon"
              onClick={submitChore}
              disabled={!draftTitle.trim()}
              aria-label="Add chore"
            >
              <Plus />
            </button>
          </div>
          <button
            type="button"
            className="fb-ghost fb-choreroutinebtn"
            onClick={() => setAddingRoutine(true)}
          >
            + Routine
          </button>
        </div>
      </div>

      <div className="fb-chorecols">
        {roster.map((m) => (
          <div
            key={m.id}
            className={`fb-chorecol${selectedId ? " is-dropready" : ""}`}
            onDragOver={allowDrop}
            onDrop={dropOn(m.id)}
          >
            <button
              type="button"
              className="fb-chorecolhead"
              style={{ borderColor: m.color }}
              onClick={() => selectedId && assign(selectedId, m.id)}
            >
              <Avatar member={m} size={32} />
              <span>{m.name}</span>
            </button>
            <div className="fb-chorelist">
              {sortTasks(columnFor(m.id)).map((t) => (
                <ChoreCard
                  key={t.id}
                  task={t}
                  selected={selectedId === t.id}
                  onSelect={() => selectCard(t.id)}
                  onToggle={() => toggleTask(t.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {addingRoutine && (
        <RoutineForm
          members={roster.length ? roster : members}
          mode={mode}
          onSave={(draft) => {
            addRoutine(draft);
            setAddingRoutine(false);
          }}
          onClose={() => setAddingRoutine(false)}
        />
      )}
    </div>
  );
}

/*
  Completed chores sink to the bottom — a render rule, not a reorder
  (schema.js's own comment on Task.order). Above that split, a recurring
  chore surfaces before ad-hoc ones so the thing that resets every week is
  the first thing seen; within each group, `order` is the manual bank
  position a person left a chore in.
*/
function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done) return (a.doneAt?.getTime() ?? 0) - (b.doneAt?.getTime() ?? 0);
    const ar = a.routineId ? 0 : 1;
    const br = b.routineId ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.order - b.order;
  });
}
