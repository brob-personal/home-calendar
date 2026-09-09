import fit from "./shell/Fit.js";
import tokens from "./tokens.js";
import root from "./shell/Root.js";
import header from "./shell/Header.js";
import countdowns from "./shell/Countdowns.js";
import day from "./views/DayView.js";
import week from "./views/WeekView.js";
import month from "./views/MonthView.js";
import agenda from "./views/AgendaView.js";
import footer from "./shell/Footer.js";
import avatar from "./shell/Avatar.js";
import notes from "./notes/Notes.js";
import sheet from "./shell/Sheet.js";
import sleep from "./idle/SleepVeil.js";
import screensaver from "./idle/Screensaver.js";
import motion from "./motion.js";

/*
  R5: reorganizes R2's fifteen JS template-literal chunks to mirror the
  component tree in PLAN.md §2 (shell/, views/, notes/, idle/) plus
  tokens.js and motion.js, which don't belong to a single component, and
  replaces every hardcoded colour/shadow/layout literal with a var()
  pointing at tokens.js.

  Stays JS templates, not real .css files loaded with Vite's `?raw`: R5
  tried that conversion first and confirmed vitest.config.js's `css: false`
  (R1-owned) stubs *any* .css import, `?raw` suffix or not, to an empty
  string under test — the same wall R2's original comment here warned
  about before deciding against real .css files. Rather than touch a file
  R1 owns to work around it, R5 kept the mechanism and moved the value.

  Order is still the contract, for two reasons:
    - `fit` must lead, because its Google Fonts @import must precede every
      rule in the sheet or the browser drops it. tokens.js's custom
      properties resolve at used-value time, not parse order, so having
      Fit's rules reference tokens defined later in the same sheet is safe.
    - `motion` must trail, because prefers-reduced-motion overrides
      transition and animation durations declared above it.

  `styles.contract.test.js` used to assert this join was byte-identical to
  family-board.jsx's original CSS string — R2's regression guard for a
  mechanical split that changed no values. That guard stops being
  meaningful once literals are replaced by tokens, so it's deleted in the
  same commit as this file; `styles.smoke.test.js` replaces it with the
  invariants that still apply.
*/
const chunks = [fit, tokens, root, header, countdowns, day, week, month, agenda, footer, avatar, notes, sheet, sleep, screensaver, motion];

export const BOARD_CSS = chunks.join("");
