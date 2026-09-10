import { useState } from "react";
import { CaretDown } from "./icons.jsx";

/*
  Replaces Footer's row of Day/Week/Month/Agenda(/To-do) buttons with one
  pill showing the active view; tapping it lists the rest. VIEW_LABELS is
  the same "To-do" spelling override Footer used to own — SCOPING.txt writes
  it "To-do", every other view id is already its own display label.
*/
const VIEW_LABELS = { todo: "To-do" };
const labelFor = (v) => VIEW_LABELS[v] || v[0].toUpperCase() + v.slice(1);

export function ViewSwitcher({ view, setView, views }) {
  const [open, setOpen] = useState(false);
  const others = views.filter((v) => v !== view);

  const pick = (v) => {
    setView(v);
    setOpen(false);
  };

  return (
    <div className="fb-headdd">
      <button
        className="fb-viewbtn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {labelFor(view)}
        <CaretDown />
      </button>
      {open && (
        <>
          <div className="fb-ddscrim" onClick={() => setOpen(false)} />
          <div className="fb-ddpop" role="listbox">
            {others.map((v) => (
              <button key={v} className="fb-ddopt" onClick={() => pick(v)} role="option">
                {labelFor(v)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
