/*
  Sheets and every form control inside them — the shared vocabulary for the
  composer and the settings panel.

  .fb-shade was 40x28, the last of the six selectors on R12's 44pt list; see
  tap-target-audit.md. Raised to 48x44 — kept rectangular rather than
  squared off to --tap-min on both axes, so it still reads as a distinct
  shape from the circular avatar/pen swatches. `.fb-ramp`'s flex-wrap
  absorbs the extra width; nothing needed to change at the sheet level.
  `.fb-ramp-sm .fb-shade` is untouched — that variant renders as a `<span>`
  in Settings.jsx, not a `<button>`, so it was never a tap target.

  .fb-scrim is the click-to-close backdrop. Sheet closes on scrim click
  only, with no focus trap and no Escape handling — R12's backlog item 6.

  Why the wide sheet used to hang off the right of the canvas, and why the
  obvious fix for it did nothing.

  .fb-scrim is `position: absolute; inset: 0` inside .fb-root, so it is the
  canvas: 900px wide, padding 26px, 848px of room. The wide sheet asked for
  `width: 900px` — the whole canvas — which is 52px more than that, and an
  oversized grid item overflows its track's *end* edge, so all of it went off
  the right and .fb-root's `overflow: hidden` cut it.

  #61 added `max-width: 100%` to .fb-sheet and that is a no-op here, which is
  worth writing down because it looks like it should work. The scrim had no
  `grid-template-columns`, so its single column was an implicit `auto` track,
  and an auto track is sized *from its items*: the sheet's 900px contribution
  set the track to 900px, and a percentage max-width resolves against the grid
  area, so `100%` came back as 900px and clamped nothing. The track itself was
  what overflowed the scrim, and the item was merely filling it.

  So the fix is on the scrim, not the sheet: `grid-template-columns:
  minmax(0, 1fr)` makes the column a definite 848px, taken from the scrim's
  content box instead of from whatever is placed in it. With the track
  definite, .fb-sheet's `max-width: 100%` finally has a real number to
  resolve against, and `.is-wide` can just ask for `100%` of it rather than
  naming 900 and being wrong about it.

  Measured in Chrome rather than argued from the spec, because the argument
  from the spec is what shipped #61. A 900px canvas, a scrim padding 26, and
  a sheet asking for 900:

    auto track      + max-width: 100%   ->  900px wide, right edge 926, +26
    minmax(0, 1fr)  + max-width: 100%   ->  848px wide, right edge 874, fits
    minmax(0, 1fr)  + width: 100%       ->  848px wide, right edge 874, fits
    1fr             + max-width: 100%   ->  900px wide, right edge 926, +26

  The last line is why `minmax(0, ...)` is load-bearing and must not be
  relaxed to a bare `1fr`: `1fr` means `minmax(auto, 1fr)`, and that auto
  minimum floors the track at the item's min-content contribution, which is
  the same 900px and the same bug. styles.smoke.test.js pins it, though only
  as text — jsdom has no layout engine, so no test in this repo can catch a
  regression here by measuring. That is the standing gap this bug came
  through, and it is why the numbers above are written down.
*/
export default `
/* Sheets */
.fb-scrim {
  position: absolute; inset: 0; z-index: 40;
  background: var(--scrim); backdrop-filter: blur(3px);
  display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; padding: 26px;
}
.fb-sheet {
  width: 560px; max-width: 100%; max-height: 100%;
  background: var(--paper); border-radius: 18px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 20px 60px var(--shadow-sheet);
}
/* Not 900px. The wide sheet wants every pixel the scrim will give it, and
   the scrim's column is now exactly that, so this asks for the room rather
   than for a number that has to be kept in step with the canvas by hand. */
.fb-sheet.is-wide { width: 100%; }
.fb-sheethead {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid var(--line);
}
.fb-sheethead h2 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -.025em; }
.fb-sheetbody {
  padding: 20px; display: flex; flex-direction: column; gap: 18px;
  overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none;
}
.fb-sheetbody::-webkit-scrollbar { display: none; }
.fb-sheetfoot { display: flex; justify-content: flex-end; gap: 10px; padding-top: 2px; }

.fb-preview { border-radius: 10px; padding: 16px 18px; font-size: 17px; font-weight: 700; color: var(--ink-on-color); }
.fb-field { display: flex; flex-direction: column; gap: 9px; }
.fb-fieldlabel { font-size: 12px; font-weight: 700; color: var(--mute); }
.fb-input {
  background: var(--surface); border: 1px solid transparent; border-radius: 10px;
  padding: 11px 13px; font-size: 15px; color: var(--ink); width: 100%;
}
.fb-input::placeholder { color: var(--mute); }
.fb-input:focus { border-color: var(--line); background: var(--paper); }
.fb-input-lg { font-size: 21px; font-weight: 600; padding: 14px 16px; }
.fb-input-sm { width: auto; min-width: 108px; padding: 9px 11px; font-size: 14px; }
.fb-input-hex { width: 96px; min-width: 0; font-size: 13px; font-variant-numeric: tabular-nums; }

.fb-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.fb-pill {
  font-size: 14px; font-weight: 600; padding: 10px 15px; white-space: nowrap;
  background: var(--surface); border: 1px solid transparent; border-radius: 10px; color: var(--mute);
  display: inline-flex; align-items: center; gap: 8px;
}
.fb-pill.is-on { background: var(--ink); color: var(--paper); }
.fb-avpill {
  display: inline-flex; align-items: center; gap: 9px;
  font-size: 14px; font-weight: 600; padding: 6px 16px 6px 7px;
  background: var(--surface); border: 2px solid transparent; border-radius: 999px; color: var(--ink);
}
.fb-avpill-avatar { position: relative; display: inline-flex; }
.fb-avpill-warn {
  position: absolute; top: -3px; right: -3px; width: 15px; height: 15px;
  border-radius: 50%; background: var(--warn-bg); color: var(--ink-on-dark);
  font-size: 10px; font-weight: 800; line-height: 15px; text-align: center;
  border: 2px solid var(--paper);
}
.fb-textwarn { color: var(--warn-ink); }
.fb-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }
.fb-ramp { display: flex; gap: 6px; flex-wrap: wrap; }
.fb-shade { width: 48px; height: var(--tap-min); border-radius: 8px; display: block; }
.fb-ramp-sm .fb-shade { width: 22px; height: 16px; border-radius: 4px; }
button.fb-shade { border: 2px solid transparent; }
button.fb-shade.is-on { border-color: var(--ink); }

.fb-ghost {
  font-size: 14px; font-weight: 600; padding: 11px 17px;
  background: var(--surface); border-radius: 10px; color: var(--mute);
}
.fb-ghost-sm { font-size: 12px; padding: 8px 12px; }
/* Shared with the old footer's "New event" button before the header
   redesign retired Footer.jsx — now just the sheets' primary action. */
.fb-primary {
  font-size: 14px; font-weight: 700; padding: 12px 20px;
  border-radius: 11px; background: var(--ink); color: var(--paper);
}
/* R7: EventDetailSheet's delete path. Trigger stays a quiet ghost button so
   opening the sheet doesn't read as an ultimatum; the confirm step is the one
   filled in danger red. */
.fb-textdanger { color: var(--danger-ink); }
.fb-danger { background: var(--danger-bg); color: var(--ink-on-dark); }
.fb-deleteprompt { margin-right: auto; color: var(--ink); font-weight: 600; }
.fb-check { display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; }
.fb-check-sm { font-size: 13px; color: var(--mute); }
.fb-check input { width: 19px; height: 19px; accent-color: var(--ink); }
.fb-inline { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; }
.fb-inlabel { font-size: 13px; color: var(--mute); }
.fb-inval { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fb-note { margin: 0; font-size: 12px; line-height: 1.6; color: var(--mute); max-width: 68ch; }

.fb-members { display: flex; flex-direction: column; gap: 12px; }
.fb-memberblock {
  display: flex; flex-direction: column; gap: 7px;
  padding-bottom: 11px; border-bottom: 1px solid var(--line);
}
.fb-memberrow { display: flex; align-items: center; gap: 6px; }
/*
  The Family roster row: an avatar and six controls on one 808px line, and
  the tightest thing in the panel by a wide margin. This is the only place in
  the sheet where the fields are sized rather than left at a bare
  width: auto, because an input's intrinsic width is its size attribute's 20
  characters and seven of those do not fit any sheet this canvas can hold.

  Two rules, and between them the row cannot overflow at any sheet width:

  1. Everything with a knowable width gets one. The name needs to show a
     first name, the hex six digits and a hash, and neither wants more.
  2. The two id fields are flex: 1 1 0 with min-width: 0, so they divide
     whatever is left over. The row's width is therefore the container's and
     never the sum of its inputs -- and the ids are the fields that actually
     want the slack, being a whole email address and a Drive id.

  Type is down a long way from the sheet's 15px default, to 11px, with the
  hex at 10. That is small, and small is what was asked for, but it is also
  where this row is read from: nobody edits a Drive folder id from across the
  room, and Fit's 1.2x upscale puts 11px back at ~13 screen px on the wall.
  The avatar and swatch come down with them so the row reads as one scale
  rather than as small fields wedged between full-size ornaments.

  What that costs, recorded rather than buried: the swatch was 38px, which at
  1.2x was 45.6 screen px and cleared Apple's 44pt. At 30px it is 36 and does
  not. It is not one of the six selectors in tap-target-audit.md, so this is
  not that table being walked back down, but it is a real step away from the
  minimum and the table's reasoning would not have liked it. The trade is
  deliberate: a colour picker in a settings panel opened a few times a year,
  against a roster row that is legible and whole on the board it ships on.
*/
.fb-memberrow .fb-input { font-size: 11px; padding: 7px 8px; }
.fb-memberrow .fb-input-name { flex: none; width: 92px; min-width: 0; }
.fb-memberrow .fb-input-hex { flex: none; width: 66px; font-size: 10px; }
.fb-memberrow .fb-input-id { flex: 1 1 0; width: auto; min-width: 0; }
.fb-memberrow .fb-swatch { width: 30px; height: 30px; border-radius: 7px; }
.fb-memberrow .fb-ghost-sm { flex: none; font-size: 10px; padding: 6px 8px; }
/* padding-left keeps the foot's first checkbox under the row's first field,
   so it stays the avatar's width plus the row's gap. */
.fb-memberfoot { display: flex; align-items: center; gap: 12px; padding-left: 40px; }
.fb-memberfoot .fb-check-sm { font-size: 11px; }
.fb-memberfoot .fb-check input { width: 15px; height: 15px; }
.fb-memberfoot .fb-ramp-sm .fb-shade { width: 18px; height: 13px; }
.fb-memberfoot .fb-ramp { margin-left: auto; }
.fb-swatch {
  width: 38px; height: 38px; flex: none; padding: 0;
  border: 1px solid var(--line); border-radius: 9px; background: none; cursor: pointer;
}
.fb-hexrow { display: flex; align-items: center; gap: 9px; }

.fb-timingfield {
  font-size: 15px; font-weight: 600; color: var(--ink);
  background: var(--surface); border-radius: 10px; padding: 10px 13px;
}
.fb-datepop { min-width: 260px; }
.fb-datepop-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 8px; font-size: 13px; font-weight: 700; }
.fb-datepop-dow { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 11px; color: var(--mute); padding-bottom: 4px; }
.fb-datepop-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.fb-datepop-day { padding: 8px 0; border-radius: 8px; font-size: 13px; color: var(--ink); }
.fb-datepop-day:hover:not(:disabled) { background: var(--surface); }
.fb-datepop-day.is-on { background: var(--ink); color: var(--paper); }
.fb-datepop-day:disabled { color: var(--mute); opacity: 0.4; }

.fb-timepop { max-height: 260px; overflow-y: auto; min-width: 200px; }
.fb-timeopt { display: flex; justify-content: space-between; width: 100%; }
.fb-timeopt-dur { color: var(--mute); font-weight: 500; }
.fb-timingrow { display: flex; align-items: center; gap: 10px; }
.fb-timingdash { color: var(--mute); }
.fb-timingend { display: flex; align-items: center; gap: 10px; padding-left: 30px; }

.fb-timingblock { display: flex; flex-direction: column; gap: 10px; }
.fb-iconrow { display: flex; align-items: center; gap: 12px; }
.fb-iconrow-top { align-items: flex-start; padding-top: 2px; }
.fb-iconrow svg { flex: none; color: var(--mute); }
.fb-textarea { min-height: 72px; resize: vertical; font-family: inherit; }
`;
