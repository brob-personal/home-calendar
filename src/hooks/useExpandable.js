import { useEffect, useRef, useState } from "react";

/*
  Keeps a popover mounted long enough to play its CSS exit animation instead
  of vanishing the instant `open` flips false. `open` stays the source of
  truth for aria-expanded/aria-pressed — only the DOM presence of the panel
  itself lags behind by `duration`, which must match the panel's own
  shrink/fade keyframes (fb-weather-shrink, fb-dd-shrink, ...).

  prefers-reduced-motion needs no special case here: src/styles/motion.js
  already collapses every animation-duration under .fb-root to .01ms, so the
  setTimeout below just fires almost immediately for those users instead of
  after a visible animation.
*/
export function useExpandable(open, duration = 160) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  const mountedRef = useRef(open);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (open) {
      mountedRef.current = true;
      setMounted(true);
      setClosing(false);
    } else if (mountedRef.current) {
      setClosing(true);
      timerRef.current = setTimeout(() => {
        mountedRef.current = false;
        setMounted(false);
        setClosing(false);
      }, duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [open, duration]);

  return { mounted, closing };
}
