import fit from "./fit.js";
import root from "./root.js";
import header from "./header.js";
import countdowns from "./countdowns.js";
import day from "./day.js";
import week from "./week.js";
import month from "./month.js";
import agenda from "./agenda.js";
import footer from "./footer.js";
import avatar from "./avatar.js";
import notes from "./notes.js";
import sheet from "./sheet.js";
import sleep from "./sleep.js";
import screensaver from "./screensaver.js";
import motion from "./motion.js";

/*
  PLAN.md §R2 item 4: split the 378-line CSS string
  (family-board.jsx:1729-2106) into per-component stylesheets.

  Order is the contract. CSS cascades, so concatenating these fifteen chunks
  in this sequence — the sequence the prototype declared them in — is what
  makes the split provably behaviour-neutral. `styles.contract.test.js`
  asserts the join is byte-identical to the original string, so a reviewer
  does not have to take that on faith, and R5 inherits a regression guard
  rather than a promise.

  Two positions are load-bearing beyond mere cascade:
    - `fit` must lead, because its Google Fonts @import must precede every
      rule in the sheet or the browser drops it.
    - `motion` must trail, because prefers-reduced-motion overrides
      transition and animation durations declared above it.

  Why strings and not .css files. Three reasons, all of which R5 should weigh
  before converting:
    1. Cascade order stays explicit here. With fifteen `import "./x.css"`
       statements the order becomes a property of the module graph, which is
       exactly the kind of invisible coupling this refactor is meant to
       remove.
    2. `vitest.config.js` sets `css: false`, so Vite stubs CSS imports under
       test. R1's smoke test asserts the sheet contains "1080px" and "810px";
       real .css files would make that assertion unverifiable in jsdom.
    3. fit.js interpolates CANVAS_W / CANVAS_H from src/lib/canvas.js instead
       of restating 1080 and 810 — the duplication R5's item 3 is about.
*/
const chunks = [
  fit,
  root,
  header,
  countdowns,
  day,
  week,
  month,
  agenda,
  footer,
  avatar,
  notes,
  sheet,
  sleep,
  screensaver,
  motion,
];

export const BOARD_CSS = chunks.join("");
