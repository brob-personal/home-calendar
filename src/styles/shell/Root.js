/*
  The board root: typography, the button and focus resets every component
  below relies on, the month-art wash, and the flex column that gives the
  header, countdowns, stage and footer their fixed heights.

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

.fb-art { position: absolute; inset: 0; opacity: .5; pointer-events: none; }

.fb-board {
  position: relative; display: flex; flex-direction: column;
  height: 100%; padding: 22px 24px var(--board-pad-b); gap: var(--board-gap);
}
`;
