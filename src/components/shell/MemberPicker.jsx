import { useState } from "react";
import { Home } from "./icons.jsx";
import { Avatar } from "./Avatar.jsx";

/*
  Replaces Footer's always-visible avatar-toggle row with a single "home"
  icon badged with how many of `members` are currently shown; tapping it
  opens the same toggle list, plus the Reset chip that used to sit next to
  the legend (PLAN.md's filterTouched/resetFilter, unchanged — only the UI
  moved).

  Toggling a member does not close the popover — it's a checklist, so
  tapping several faces in a row without reopening each time is the point.
  Reset does close it: it's a "done, back to default" action, not one more
  item in the list.
*/
export function MemberPicker({ members, isShown, onToggleMember, showReset, onReset }) {
  const [open, setOpen] = useState(false);
  const shownCount = members.filter((m) => isShown(m.id)).length;

  return (
    <div className="fb-headdd">
      <button
        className="fb-homebtn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose whose calendars to show"
      >
        <Home />
        <span className="fb-homecount">{shownCount}</span>
      </button>
      {open && (
        <>
          <div className="fb-ddscrim" onClick={() => setOpen(false)} />
          <div className="fb-ddpop fb-homepop" role="listbox">
            {members.map((m) => {
              const on = isShown(m.id);
              return (
                <button
                  key={m.id}
                  className={`fb-homeopt${on ? "" : " is-off"}`}
                  onClick={() => onToggleMember(m.id)}
                  aria-pressed={on}
                  role="option"
                >
                  <Avatar member={m} size={26} off={!on} />
                  {m.name}
                </button>
              );
            })}
            {showReset && (
              <button
                className="fb-ddopt fb-homereset"
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
              >
                Reset
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
