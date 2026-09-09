/*
  Sticky notes — NoteDock, NoteWindow, NoteThumb.

  Three of the six selectors on R12's 44pt list are here — .fb-notenav /
  .fb-noteclose at 30px, .fb-pen at 22px and .fb-width at 26px. .fb-fab at
  56px is the only interactive element in the whole board that already
  passes. Left as found; raising them is R12's item 1, tracked in
  tap-target-audit.md.

  touch-action: none on .fb-notehead and .fb-notecanvas is load-bearing,
  not decoration: without it iOS Safari claims the gesture for scrolling
  and neither dragging the window nor drawing a stroke works at all.

  .fb-dock's bottom used to hardcode 92px — R5's item 3 magic number, named
  in PLAN.md: it has to clear the footer plus the board's bottom padding
  and flex gap. --dock-bottom in tokens.js derives it from the same
  --footer-h / --board-gap / --board-pad-b those two owners already
  declare, so the three values can't drift apart.
*/
export default `
/* Sticky notes */
.fb-dock {
  position: absolute; right: 24px; bottom: var(--dock-bottom); z-index: 30;
  display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
}
.fb-stickypeek {
  padding: 8px; border-radius: 12px; overflow: hidden;
  background: var(--note-paper); box-shadow: 0 4px 16px var(--shadow-peek);
  transform: rotate(-1.4deg);
}
.fb-fab {
  width: 56px; height: 56px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--ink); color: var(--paper);
  box-shadow: 0 6px 20px var(--shadow-fab);
}
.fb-notewrap {
  position: absolute; z-index: 45;
  background: var(--note-paper); border-radius: 14px; overflow: hidden;
  box-shadow: 0 18px 50px var(--shadow-note);
  color: var(--note-ink);
}
.fb-notehead {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; background: var(--note-header); cursor: grab; touch-action: none;
}
.fb-notehead:active { cursor: grabbing; }
.fb-notedate { flex: 1; text-align: center; font-size: 14px; font-weight: 700; }
.fb-notenav, .fb-noteclose {
  display: grid; place-items: center; width: 30px; height: 30px;
  border-radius: 8px; color: var(--note-mute);
}
.fb-notecanvas { display: block; touch-action: none; cursor: crosshair; }
.fb-notecanvas.is-readonly { cursor: default; opacity: .9; }
.fb-notetools {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 11px; background: var(--note-header);
}
.fb-pens { display: flex; gap: 6px; }
.fb-pen { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; }
.fb-pen.is-on { border-color: var(--note-ink); }
.fb-widths { display: flex; gap: 4px; color: var(--note-ink); }
.fb-width { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; opacity: .45; }
.fb-width.is-on { opacity: 1; background: var(--note-width-on-bg); }
.fb-width span { display: block; border-radius: 50%; }
.fb-noteact {
  margin-left: auto; font-size: 12px; font-weight: 700; color: var(--note-mute);
  padding: 6px 10px; border-radius: 8px;
}
.fb-noteact + .fb-noteact { margin-left: 0; }
.fb-noteold { font-size: 12px; font-weight: 600; color: var(--note-mute); }
`;
