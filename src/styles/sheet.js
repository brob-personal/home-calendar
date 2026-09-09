/*
  Sheets and every form control inside them — the shared vocabulary for the
  composer and the settings panel.

  `.fb-shade` at 40x28 is the last of the six selectors on R12's 44pt list.

  `.fb-scrim` is the click-to-close backdrop, and Deferred Defect (R7/R12
  territory) applies: Sheet closes on scrim click only, with no focus trap and
  no Escape handling. R12's backlog item 6 owns that.
*/
export default `
/* Sheets */
.fb-scrim {
  position: absolute; inset: 0; z-index: 40;
  background: rgba(28,32,40,.32); backdrop-filter: blur(3px);
  display: grid; place-items: center; padding: 26px;
}
.fb-sheet {
  width: 560px; max-height: 100%;
  background: var(--paper); border-radius: 18px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 20px 60px rgba(24,28,36,.24);
}
.fb-sheet.is-wide { width: 900px; }
.fb-sheethead {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid var(--line);
}
.fb-sheethead h2 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -.025em; }
.fb-sheetbody { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
.fb-sheetfoot { display: flex; justify-content: flex-end; gap: 10px; padding-top: 2px; }

.fb-preview { border-radius: 10px; padding: 16px 18px; font-size: 17px; font-weight: 700; color: #24262B; }
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
.fb-pills-scroll { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
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
.fb-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }
.fb-ramp { display: flex; gap: 6px; flex-wrap: wrap; }
.fb-shade { width: 40px; height: 28px; border-radius: 7px; display: block; }
.fb-ramp-sm .fb-shade { width: 22px; height: 16px; border-radius: 4px; }
button.fb-shade { border: 2px solid transparent; }
button.fb-shade.is-on { border-color: var(--ink); }

.fb-ghost {
  font-size: 14px; font-weight: 600; padding: 11px 17px;
  background: var(--surface); border-radius: 10px; color: var(--mute);
}
.fb-ghost-sm { font-size: 12px; padding: 8px 12px; }
/* R7: EventDetailSheet's delete path. Trigger stays a quiet ghost button so
   opening the sheet doesn't read as an ultimatum; the confirm step is the one
   filled in danger red. */
.fb-textdanger { color: #C43A33; }
.fb-danger { background: #E0574F; color: #fff; }
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
`;
