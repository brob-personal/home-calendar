/*
  Countdowns — 46px — and the stage that takes the rest of the column.

  `.fb-stage` sits here rather than in root.js because it is the sibling that
  absorbs whatever height the countdown row does or does not occupy: the row
  is only rendered when there is a milestone to show, so the stage grows by
  46px plus one 14px gap when nothing is counting down.
*/
export default `
/* Countdowns — 46px */
.fb-countdowns { display: flex; gap: 30px; align-items: baseline; height: 46px; flex: none; }
.fb-cd { display: flex; align-items: baseline; gap: 6px; }
.fb-cdnum { font-size: 28px; font-weight: 800; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.fb-cdunit { font-size: 13px; color: var(--mute); }
.fb-cdlabel { font-size: 15px; font-weight: 500; }

.fb-stage { flex: 1; min-height: 0; }
`;
