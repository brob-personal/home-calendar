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
*/
export default `
/* Sheets */
.fb-scrim {
  position: absolute; inset: 0; z-index: 40;
  background: var(--scrim); backdrop-filter: blur(3px);
  display: grid; place-items: center; padding: 26px;
}
.fb-sheet {
  width: 560px; max-height: 100%;
  background: var(--paper); border-radius: 18px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 20px 60px var(--shadow-sheet);
}
.fb-sheet.is-wide { width: 900px; }
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
.fb-memberrow { display: flex; align-items: center; gap: 9px; }
.fb-memberfoot { display: flex; align-items: center; gap: 16px; padding-left: 53px; }
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
