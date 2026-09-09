/*
  The board root: typography, the button and focus resets every component
  below relies on, the month-art wash, and the flex column that gives the
  header, countdowns, stage and footer their fixed heights.

  The six custom properties these rules read — --paper, --surface, --line,
  --ink, --mute, --now — are set as inline style on .fb-root by App.jsx from
  the active theme. That is the seam R5 turns into tokens.css.

  The :focus-visible rule and the reduced-motion block in motion.js are the
  two accessibility affordances R5's backlog item 6 must preserve.
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
  height: 100%; padding: 22px 24px 18px; gap: 14px;
}
`;
