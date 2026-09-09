import { useState, useEffect, useRef, useCallback } from "react";

/*
  Moved verbatim from family-board.jsx:375-394.

  Deferred Defect #3 lives here and is deliberately preserved. `reset` is a
  useCallback over [seconds, enabled], and the effect depends on [reset], so
  every settings edit that changes idleMinutes — or any of the four flags that
  feed `enabled` — tears down and re-adds all three window listeners. R12 owns
  the fix. R2's mandate is zero behaviour change, so the wiring is untouched.
*/
export function useIdle(seconds, enabled) {
  const [idle, setIdle] = useState(false);
  const timer = useRef(null);
  const reset = useCallback(() => {
    setIdle(false);
    clearTimeout(timer.current);
    if (enabled) timer.current = setTimeout(() => setIdle(true), seconds * 1000);
  }, [seconds, enabled]);

  useEffect(() => {
    reset();
    const evs = ["pointerdown", "keydown", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer.current);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [reset]);

  return [idle, reset];
}
