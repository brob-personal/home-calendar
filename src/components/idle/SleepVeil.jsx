import { fmtClock, DOW } from "../../lib/date.js";

/*
  Moved verbatim from family-board.jsx:1630-1641.

  The whole veil is one button, because the entire screen is the tap target
  that wakes the board — the iPad's Auto-Lock is set to Never, so there is no
  lock screen, no swipe and no passcode to get past. `onWake` buys
  `wakeTapSeconds` of visibility (useSleep) before the veil returns.

  `Math.max(opacity, 0.02)` floors the clock's visibility: at a sleepDim of 0
  a completely invisible clock on a completely black screen would be
  indistinguishable from a dead device.
*/
export function SleepVeil({ now, opacity, onWake, timeFormat }) {
  return (
    <button className="fb-veil" onClick={onWake} aria-label="Wake the board">
      <div className="fb-veilinner" style={{ opacity: Math.max(opacity, 0.02) }}>
        <span className="fb-veilclock">{fmtClock(now, timeFormat)}</span>
        <span className="fb-veildate">
          {DOW[now.getDay()]} {now.getDate()}
        </span>
      </div>
    </button>
  );
}
