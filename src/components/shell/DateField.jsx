import { useState } from "react";

import { stepAnchor, sameDay, startOfDay, dayKey, fmtFullDate, DOW_LONG, MONTH_LONG } from "../../lib/date.js";

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/*
  A button reading the full date ("Wednesday, September 9") that opens a
  month-grid popover on click. Built on the same fb-headdd/fb-ddscrim/fb-ddpop
  mechanics MemberPicker and ViewSwitcher already use — one popover recipe,
  reused rather than reinvented for the event form's date fields.
*/
export function DateField({ value, onChange, minDate, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value));

  const openPicker = () => {
    setViewMonth(startOfMonth(value));
    setOpen(true);
  };

  const pick = (day) => {
    onChange(day);
    setOpen(false);
  };

  const firstWeekday = startOfMonth(viewMonth).getDay();
  const count = daysInMonth(viewMonth);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  const floor = minDate ? startOfDay(minDate) : null;

  return (
    <div className="fb-headdd fb-datefield">
      <button type="button" className="fb-timingfield" onClick={openPicker} aria-label={ariaLabel}>
        {fmtFullDate(value)}
      </button>
      {open && (
        <>
          <div className="fb-ddscrim" onClick={() => setOpen(false)} />
          <div className="fb-ddpop fb-datepop" role="dialog" aria-label={ariaLabel}>
            <div className="fb-datepop-head">
              <button
                type="button"
                className="fb-ghost-sm"
                onClick={() => setViewMonth((m) => stepAnchor("month", m, -1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <span>
                {MONTH_LONG[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </span>
              <button
                type="button"
                className="fb-ghost-sm"
                onClick={() => setViewMonth((m) => stepAnchor("month", m, 1))}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <div className="fb-datepop-dow">
              {DOW_LONG.map((d) => (
                <span key={d}>{d[0]}</span>
              ))}
            </div>
            <div className="fb-datepop-grid">
              {cells.map((day, i) =>
                day ? (
                  <button
                    type="button"
                    key={dayKey(day)}
                    className={`fb-datepop-day${sameDay(day, value) ? " is-on" : ""}`}
                    disabled={Boolean(floor && day < floor)}
                    onClick={() => pick(day)}
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <span key={`blank-${i}`} />
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
