import { useState, useEffect } from "react";

import { isAsleep } from "../lib/sleep.js";
import { useIdle } from "./useIdle.js";

/*
  Sleep, idle and the tap-to-wake grace window — carved out of
  family-board.jsx:565-583 and :641-644.

  `blocked` collapses the root's old `!panel && !noteOpen` pair into one flag.
  In the prototype `panel` is null | "compose" | "settings" and was tested for
  truthiness, so Boolean(panel) || noteOpen is the same predicate. The board
  must not slide into the screensaver while somebody is mid-sentence in the
  composer or drawing on a note.

  Two distinct mechanisms, easy to confuse:

    - `dimmed` is scheduled. It follows the clock via isAsleep(), covers the
      board with SleepVeil between the configured hours, and a tap buys
      `wakeTapSeconds` of visibility before it returns.
    - `showSaver` is idle-driven. It follows inactivity via useIdle and shows
      the photo screensaver, and it is suppressed entirely while asleep so the
      two never stack.

  R14's runbook note applies here: neither of these is the OS. Auto-Lock is
  set to Never and the iPad never shows a lock screen; everything visible
  happens inside this hook.
*/
export function useSleep(now, settings, blocked) {
  const [wakeUntil, setWakeUntil] = useState(0);

  const sleeping = isAsleep(now, settings.bedtime, settings.wakeTime);
  const awakeNow = Date.now() < wakeUntil;
  const dimmed = sleeping && !awakeNow;

  const [idle, resetIdle] = useIdle(
    settings.idleMinutes * 60,
    settings.screensaver && !sleeping && !blocked,
  );
  const showSaver = settings.screensaver && idle && !sleeping && !blocked;

  useEffect(() => {
    if (!awakeNow) return;
    const id = setTimeout(() => setWakeUntil(0), wakeUntil - Date.now());
    return () => clearTimeout(id);
  }, [wakeUntil, awakeNow]);

  const wake = () => {
    setWakeUntil(Date.now() + settings.wakeTapSeconds * 1000);
    resetIdle();
  };

  return { dimmed, showSaver, wake };
}
