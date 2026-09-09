# Tap-target audit

PLAN.md §R5 backlog item 4: publish `--tap-min: 44px` (Apple's minimum hit
target) and hand R12 the list of selectors currently under it. This is that
list. R5 publishes and documents; raising these to 44pt is R12's backlog
item 1 (Wave 3) and Deferred Defects table rows are already filed against
each one.

| Selector | File | Current size | Gap |
|---|---|---|---|
| `.fb-pen` | `src/styles/notes/Notes.js` | 22×22px | 22px short |
| `.fb-width` | `src/styles/notes/Notes.js` | 26×26px | 18px short |
| `.fb-notenav`, `.fb-noteclose` | `src/styles/notes/Notes.js` | 30×30px | 14px short |
| `.fb-shade` | `src/styles/shell/Sheet.js` | 40×28px | 16px short (height) |
| `.fb-icon` | `src/styles/shell/Header.js` | 42×42px | 2px short |

`.fb-fab` (`src/styles/notes/Notes.js`, 56×56px) is the one interactive
element already at or above `--tap-min` — listed for completeness, not as a
gap.

Not included: `.fb-av` (Avatar), whose size is a `size` prop passed as
inline style per call site (26–44px across contexts, see
`src/styles/shell/Avatar.js`'s header comment), not a rule in this
stylesheet — R12 audits those call sites directly, not through
`src/styles/**`.
