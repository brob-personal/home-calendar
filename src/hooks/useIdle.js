import { useState, useEffect, useRef, useCallback } from "react";

/*
  Moved verbatim from family-board.jsx:375-394.

  Deferred Defect #3, fixed: `reset` used to be a useCallback over
  [seconds, enabled], and the listener effect depended on [reset], so every
  settings edit that changes idleMinutes — or any of the four flags that feed
  `enabled` — tore down and re-added all three window listeners. `seconds`
  and `enabled` now live in refs that `reset` reads from, so `reset` itself
  is stable across renders and the listener effect below runs its
  add/removeEventListener pair exactly once, on mount and unmount. A second
  effect still calls `reset()` whenever `seconds`/`enabled` change, so the
  timer keeps restarting with the new duration — only the listener churn is
  gone, not the behaviour.
*/
export function useIdle(seconds, enabled) {
  const [idle, setIdle] = useState(false);
  const timer = useRef(null);
  const secondsRef = useRef(seconds);
  const enabledRef = useRef(enabled);
  secondsRef.current = seconds;
  enabledRef.current = enabled;

  const reset = useCallback(() => {
    setIdle(false);
    clearTimeout(timer.current);
    if (enabledRef.current) {
      timer.current = setTimeout(() => setIdle(true), secondsRef.current * 1000);
    }
  }, []);

  useEffect(() => {
    reset();
  }, [seconds, enabled, reset]);

  useEffect(() => {
    const evs = ["pointerdown", "keydown", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer.current);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [reset]);

  return [idle, reset];
}
