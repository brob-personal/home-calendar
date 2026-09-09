/*
  One-shot verification + fixture generator for PLAN.md §R2 item 4.

  Pulls the CSS template literal out of family-board.jsx, resolves its two
  interpolations, writes it to src/test/fixtures/prototype-css.txt, and checks
  it against the fifteen-chunk join in src/styles/index.js.

  Run against the prototype while it still exists:

      node scripts/extract-prototype-css.mjs

  The fixture it writes is what src/styles/styles.contract.test.js compares
  against after item 6 deletes the prototype, so the "no visual regression"
  claim stays testable for R5 rather than becoming folklore.
*/
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync("family-board.jsx", "utf8");

const marker = "const CSS = `";
const open = src.indexOf(marker);
if (open === -1) throw new Error("could not find `const CSS = ` in the prototype");
const start = open + marker.length;
const end = src.lastIndexOf("`");
if (end <= start) throw new Error("could not find the closing backtick");

const raw = src.slice(start, end);
const resolved = raw
  .replace(/\$\{CANVAS_W\}/g, "1080")
  .replace(/\$\{CANVAS_H\}/g, "810")
  /*
    family-board.jsx is checked in with CRLF endings; the new modules under
    src/ are LF, per .prettierrc's "endOfLine": "lf". Normalizing here is what
    makes the comparison meaningful rather than 377 false differences — one
    per line. CSS treats CR, LF and CRLF identically as whitespace between
    declarations, so this is not a behavioural difference, and the first run
    of this script confirmed it was the *only* difference: 378 lines on both
    sides, and a 377-byte gap that is exactly the missing carriage returns.
  */
  .replace(/\r\n/g, "\n");
if (resolved.includes("${")) throw new Error("unresolved interpolation left in the extracted CSS");

mkdirSync("src/test/fixtures", { recursive: true });
writeFileSync("src/test/fixtures/prototype-css.txt", resolved, "utf8");

const { BOARD_CSS } = await import("../src/styles/index.js");

console.log("prototype bytes:", resolved.length);
console.log("BOARD_CSS bytes:", BOARD_CSS.length);
console.log("IDENTICAL:", BOARD_CSS === resolved);

if (BOARD_CSS !== resolved) {
  const a = resolved.split("\n");
  const b = BOARD_CSS.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.error("first diff at line", i + 1);
      console.error("  prototype:", JSON.stringify(a[i]));
      console.error("  split    :", JSON.stringify(b[i]));
      break;
    }
  }
  console.error("line counts — prototype:", a.length, "split:", b.length);
  process.exitCode = 1;
}
