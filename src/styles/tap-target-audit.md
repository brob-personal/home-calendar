# Tap-target audit

PLAN.md §R5 backlog item 4: publish `--tap-min: 44px` (Apple's minimum hit
target) and hand R12 the list of selectors currently under it. This is that
list. R5 published and documented; raising these to 44pt was R12's backlog
item 1 (Wave 3), now done.

| Selector | File | Was | Now |
|---|---|---|---|
| `.fb-pen` | `src/styles/notes/Notes.js` | 22×22px | 44×44px hit box, 22px visible dot preserved via `.fb-penswatch` inner span |
| `.fb-width` | `src/styles/notes/Notes.js` | 26×26px | 44×44px (inner stroke-preview `<span>` unchanged) |
| `.fb-notenav`, `.fb-noteclose` | `src/styles/notes/Notes.js` | 30×30px | 44×44px |
| `.fb-shade` | `src/styles/shell/Sheet.js` | 40×28px | 48×44px (kept rectangular; `.fb-ramp`'s `flex-wrap` absorbs the extra width) |
| `.fb-icon` | `src/styles/shell/Header.js` | 42×42px | 44×44px |

`.fb-fab` (`src/styles/notes/Notes.js`, 56×56px) was already at or above
`--tap-min` and is unchanged.

`.fb-notetools` (the note toolbar housing `.fb-pen`/`.fb-width`) gained
`flex-wrap: wrap` — five 44px pen buttons plus three 44px width buttons plus
the Undo/Clear ghost buttons no longer fit one row inside `NOTE_W` (430px),
so the row wraps to a second line rather than overflowing or forcing
`NOTE_W` wider, which would have changed the sticky note's established
proportions.

**Avatar call sites, audited directly per R5's note below.** Checked every
`<Avatar size={...}>` call site (`AgendaView` 26px, `EventDetailSheet` 28px,
`DayView` 30px, `Composer` 28px, `Footer` 30px, `Settings` 44px). None of
them is a bare tap target: the ones inside a `<button>` (`Footer`'s
`.fb-leg`, `Composer`/`EventDetailSheet`'s `.fb-avpill`) always pair the
avatar with a text label and its own padding inside a larger button, and the
rest are decorative labels with no click handler at all (`DayView`,
`AgendaView`). None of those wrapping buttons is one of the six selectors
above, so none were touched here — flagged for whoever next revisits
`.fb-leg`/`.fb-avpill` sizing, not fixed as part of this pass.

Originally not included: `.fb-av` (Avatar), whose size is a `size` prop
passed as inline style per call site (26–44px across contexts, see
`src/styles/shell/Avatar.js`'s header comment), not a rule in this
stylesheet — R12 audited those call sites directly, per above, not through
`src/styles/**`.
