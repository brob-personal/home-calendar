/*
  The board root: typography, the button and focus resets every component
  below relies on, the month-art wash, and the flex column that gives the
  header, countdowns and stage their fixed heights.

  The five per-theme custom properties this file reads through .fb-root
  (--paper --surface --line --ink --mute) come from App.jsx's inline style;
  tokens.js only supplies their fallback defaults.

  :focus-visible here and the reduced-motion block in motion.js are the two
  accessibility affordances PLAN.md §R5 item 6 requires preserving.
*/
export default `
.fb-root {
  position: relative; width: 100%; height: 100%;
  background: var(--paper); color: var(--ink);
  font-family: Archivo, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  user-select: none; overflow: hidden;
}
.fb-root *, .fb-root *::before, .fb-root *::after { box-sizing: border-box; }
.fb-root button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; }
.fb-root button:disabled { opacity: .3; cursor: default; }
.fb-root button:focus-visible, .fb-root input:focus-visible {
  outline: 2px solid var(--ink); outline-offset: 2px;
}

/* The board's one seasonal wash. It was raised to .85 to outweigh a second,
   fainter wash on .fb-stage's ::before — that pairing is what made the
   calendar read as a lighter rectangle framed against the board, so the
   stage's copy is gone (Countdowns.js) and this is now the only one. It
   covers the whole 1080x810 canvas, edge to edge and unbroken, including
   behind the calendar. */
.fb-art { position: absolute; inset: 0; opacity: .85; pointer-events: none; }

.fb-board {
  position: relative; display: flex; flex-direction: column;
  height: 100%; padding: 22px 24px var(--board-pad-b); gap: var(--board-gap);
}

/* Composer's post-save partial-failure report — one member's calendar write
   failed but the event still saved for the others; see App.jsx's addEvent. */
.fb-writewarn {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 10px;
  background: var(--warn-bg); color: var(--ink-on-dark); font-size: 13px; font-weight: 600;
}
.fb-writewarn button { color: var(--ink-on-dark); text-decoration: underline; font-weight: 700; }
`;
