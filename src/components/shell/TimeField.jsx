import { useEffect, useRef, useState } from "react";

import { fmtTime } from "../../lib/date.js";
import { parseTimeText, durationLabel, wrapDuration } from "../../lib/time.js";

const STEP = 15;
const SLOTS = Array.from({ length: (24 * 60) / STEP }, (_, i) => i * STEP);

function label(minutes, timeFormat) {
  return fmtTime(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60), timeFormat);
}

/*
  A time button that opens a scrollable 15-minute-interval list (the one
  scrollbar the redesigned event form keeps) and, on double-click, swaps to a
  free-text input instead — parseTimeText (lib/time.js) is what makes "815pm"
  and "20:15" both land on the same slot. `durationFrom`, given only on the
  end-time field, is what makes each row read "9:00a (1 hr)" — wrapDuration
  is why an end time earlier than the start still shows a positive span
  instead of a negative one.
*/
export function TimeField({ minutes, onChange, timeFormat, durationFrom, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector('[data-active="true"]');
      if (active) active.scrollIntoView({ block: "center" });
    }
  }, [open]);

  const startTyping = () => {
    setTypedValue(label(minutes, timeFormat));
    setTyping(true);
    setOpen(false);
  };

  const commitTyped = () => {
    const parsed = parseTimeText(typedValue);
    if (parsed !== null) onChange(parsed);
    setTyping(false);
  };

  const pick = (m) => {
    onChange(m);
    setOpen(false);
  };

  if (typing) {
    return (
      <input
        className="fb-input fb-timingfield"
        autoFocus
        value={typedValue}
        onChange={(e) => setTypedValue(e.target.value)}
        onBlur={commitTyped}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <div className="fb-headdd fb-timefield">
      <button
        type="button"
        className="fb-timingfield"
        onClick={() => setOpen((o) => !o)}
        onDoubleClick={startTyping}
        aria-label={ariaLabel}
      >
        {label(minutes, timeFormat)}
      </button>
      {open && (
        <>
          <div className="fb-ddscrim" onClick={() => setOpen(false)} />
          <div className="fb-ddpop fb-timepop" role="listbox" aria-label={ariaLabel} ref={listRef}>
            {SLOTS.map((m) => (
              <button
                type="button"
                key={m}
                role="option"
                data-active={m === minutes ? "true" : undefined}
                className={`fb-ddopt fb-timeopt${m === minutes ? " is-on" : ""}`}
                onClick={() => pick(m)}
              >
                {label(m, timeFormat)}
                {durationFrom !== undefined && (
                  <span className="fb-timeopt-dur"> ({durationLabel(wrapDuration(m, durationFrom))})</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
