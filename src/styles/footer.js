/*
  Footer — 60px.

  The 60px height here is the second magic-number duplication in R5's backlog
  item 3: `.fb-dock { bottom: 92px }` in notes.js has to clear this footer
  plus the board's 18px bottom padding, and nothing enforces the relationship.

  `.fb-legend` is both the colour legend and the filter control — tapping a
  face toggles that person across every view. `.fb-primary` is shared with
  the sheet footers.
*/
export default `
/* Footer — 60px */
.fb-foot { display: flex; align-items: center; gap: 18px; height: 60px; flex: none; }
.fb-views { display: flex; gap: 4px; background: var(--surface); border-radius: 12px; padding: 4px; }
.fb-view { font-size: 14px; font-weight: 600; padding: 9px 16px; border-radius: 9px; color: var(--mute); }
.fb-view.is-on { background: var(--paper); color: var(--ink); box-shadow: 0 1px 3px rgba(30,34,42,.1); }
.fb-legend { display: flex; gap: 6px; margin: 0 auto; align-items: center; }
.fb-leg {
  display: flex; align-items: center; gap: 7px;
  font-size: 13px; font-weight: 600; color: var(--ink);
  padding: 5px 12px 5px 6px; border-radius: 999px; background: var(--surface);
}
.fb-leg.is-off { color: var(--mute); background: none; }
.fb-pager { display: flex; align-items: center; gap: 8px; }
.fb-primary {
  font-size: 14px; font-weight: 700; padding: 12px 20px;
  border-radius: 11px; background: var(--ink); color: var(--paper);
}
`;
