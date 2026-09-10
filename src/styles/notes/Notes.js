/*
  Sticky notes — NoteDock, NoteWindow, NoteThumb.

  Three of the six selectors on R12's 44pt list were here — .fb-notenav /
  .fb-noteclose at 30px, .fb-pen at 22px and .fb-width at 26px. .fb-fab at
  56px was the only interactive element in the whole board that already
  passed. All raised to --tap-min (R12 item 1, tracked in
  tap-target-audit.md).

  .fb-notenav/.fb-noteclose/.fb-width only needed their own box enlarged —
  each already renders an icon or a dynamically-sized inner <span> as its
  visible content, so growing the button just adds padding around it.
  .fb-pen is different: the button *was* the 22px colour dot (`background`
  set inline on the button itself in NoteWindow.jsx), so enlarging the
  button directly would have turned each swatch into a 44px circle — a
  real visual regression to a feature this project preserves deliberately.
  Instead NoteWindow.jsx now renders the button as a 44px invisible hit
  box wrapping a `.fb-penswatch` inner span that carries the original
  22px dot and its `is-on` ring, so the visible design is unchanged.

  touch-action: none on .fb-notehead and .fb-notecanvas is load-bearing,
  not decoration: without it iOS Safari claims the gesture for scrolling
  and neither dragging the window nor drawing a stroke works at all.

  .fb-dock's bottom used to hardcode 92px — R5's item 3 magic number, named
  in PLAN.md: it had to clear the old footer plus the board's bottom padding
  and flex gap. The header redesign retired that footer row; --dock-bottom
  in tokens.js now just clears --board-pad-b, and .fb-stage's own
  margin-bottom (--stage-gap-b, styles/shell/Countdowns.js) is the reserved
  strip the FAB floats in.

  .fb-fab used to open the note window directly. It's now a menu toggle:
  tap it to reveal .fb-fabopt (the old footer "New event" button and the
  note-window opener, reunited as one menu), tap again — or the scrim — to
  collapse. The plus glyph rotates 45deg via .is-open to read as a close X,
  so the button never needs a second icon.
*/
export default `
/* Sticky notes + the combined add menu */
.fb-fabscrim { position: fixed; inset: 0; z-index: 29; }
.fb-dock {
  position: absolute; right: 24px; bottom: var(--dock-bottom); z-index: 30;
  display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
}
.fb-stickypeek {
  padding: 8px; border-radius: 12px; overflow: hidden;
  background: var(--note-paper); box-shadow: 0 4px 16px var(--shadow-peek);
  transform: rotate(-1.4deg);
}
.fb-fabopt {
  min-height: var(--tap-min); padding: 0 20px; border-radius: 999px;
  background: var(--surface); color: var(--ink); font-size: 15px; font-weight: 700;
  white-space: nowrap; box-shadow: 0 6px 20px var(--shadow-fab);
}
.fb-fab {
  width: 56px; height: 56px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--ink); color: var(--paper);
  box-shadow: 0 6px 20px var(--shadow-fab);
}
.fb-fab svg { transition: transform .15s ease; }
.fb-fab.is-open svg { transform: rotate(45deg); }
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
  display: grid; place-items: center; width: var(--tap-min); height: var(--tap-min);
  border-radius: 8px; color: var(--note-mute);
}
.fb-notecanvas { display: block; touch-action: none; cursor: crosshair; }
.fb-notecanvas.is-readonly { cursor: default; opacity: .9; }
.fb-notetools {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 9px 11px; background: var(--note-header);
}
.fb-pens { display: flex; gap: 2px; }
.fb-pen { display: grid; place-items: center; width: var(--tap-min); height: var(--tap-min); border-radius: 50%; }
.fb-penswatch { display: block; width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; }
.fb-pen.is-on .fb-penswatch { border-color: var(--note-ink); }
.fb-widths { display: flex; gap: 4px; color: var(--note-ink); }
.fb-width { display: grid; place-items: center; width: var(--tap-min); height: var(--tap-min); border-radius: 7px; opacity: .45; }
.fb-width.is-on { opacity: 1; background: var(--note-width-on-bg); }
.fb-width span { display: block; border-radius: 50%; }
.fb-noteact {
  margin-left: auto; font-size: 12px; font-weight: 700; color: var(--note-mute);
  padding: 6px 10px; border-radius: 8px;
}
.fb-noteact + .fb-noteact { margin-left: 0; }
.fb-noteold { font-size: 12px; font-weight: 600; color: var(--note-mute); }
`;
