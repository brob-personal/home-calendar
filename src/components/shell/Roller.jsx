import { useEffect, useRef, useState } from "react";

/*
  An "odometer" style value roller for the header's day-of-week and date-
  number readouts (PLAN.md polish items 1-2): when `value` changes, the old
  value slides out and the new one slides in along `dir` (1 = forward in
  time, scrolls upward; -1 = backward, scrolls downward), instead of
  swapping instantly.

  `allValues` is never shown — every possible value is stacked invisibly in
  the same grid cell (see .fb-roller in styles/shell/Header.js) purely so
  the roller's own intrinsic width is always the widest any value could be
  (all 7 weekday names, or every 1-2 digit date). That's also what keeps the
  surrounding header block from shifting horizontally as you page (item 3):
  the roller never changes size, only its visible content does.

  The current value's key changes only when `value` changes, so re-renders
  that don't change `value` (the header re-renders every clock tick) don't
  replay the CSS animation — a fresh DOM node, and the animation it plays on
  mount, only happens on an actual date change.
*/
const ROLL_MS = 220;

export function Roller({ value, allValues, dir, className = "" }) {
  const [entries, setEntries] = useState([{ key: "v0", val: value, leaving: false, animate: false }]);
  const seqRef = useRef(1);
  const prevValueRef = useRef(value);
  const timerRef = useRef(null);

  useEffect(() => {
    if (value === prevValueRef.current) return;
    prevValueRef.current = value;
    const enterKey = `v${seqRef.current++}`;
    setEntries((cur) => [
      ...cur.map((e) => ({ ...e, leaving: true, dir })),
      { key: enterKey, val: value, dir, leaving: false, animate: true },
    ]);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setEntries((cur) => cur.filter((e) => e.key === enterKey));
    }, ROLL_MS);
  }, [value, dir]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <span className={`fb-roller ${className}`}>
      {allValues.map((v) => (
        <span key={v} className="fb-roller-size" aria-hidden="true">
          {v}
        </span>
      ))}
      <span className="fb-roller-viewport">
        {entries.map((e) => (
          <span
            key={e.key}
            className={
              "fb-roller-val" +
              (e.leaving
                ? ` fb-roller-out-${e.dir > 0 ? "up" : "down"}`
                : e.animate
                  ? ` fb-roller-in-${e.dir > 0 ? "up" : "down"}`
                  : "")
            }
          >
            {e.val}
          </span>
        ))}
      </span>
    </span>
  );
}
