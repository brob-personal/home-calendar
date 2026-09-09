import { describe, it, expect } from "vitest";

import { BOARD_CSS } from "./index.js";

/*
  Vite's ?raw suffix inlines the file as a string at transform time. Read via
  node:fs instead and this fails with "The URL must be of scheme file" —
  import.meta.url is not a file:// URL under the Vitest runner.
*/
import fixture from "../test/fixtures/prototype-css.txt?raw";

/*
  R2's evidence for PLAN.md §R2's acceptance criterion — "visually identical
  at 1080x810 ... a reviewer should be able to confirm every moved line is the
  same line".

  The fixture is the CSS template literal lifted out of family-board.jsx
  before item 6 deleted it, with ${CANVAS_W}/${CANVAS_H} resolved and CRLF
  normalized to LF. It was produced by scripts/extract-prototype-css.mjs,
  which also performed this comparison live against the prototype.

  Splitting a 378-line stylesheet into fifteen files is the highest-risk part
  of a "zero behaviour change" refactor, because a lost rule or a reordered
  chunk is invisible until someone looks at the board on the wall. This test
  makes it visible in CI instead.

  R5, this file is a gift and a tripwire. You own src/styles/** and your job
  is to replace these strings with tokens.css and CSS modules, at which point
  a byte comparison stops being meaningful — delete it then, deliberately, in
  the same commit that lands the replacement. Do not delete it to make a red
  suite green.
*/

describe("board stylesheet", () => {
  it("is byte-identical to the prototype's CSS string", () => {
    expect(BOARD_CSS).toBe(fixture);
  });

  it("still declares the 1080x810 canvas contract", () => {
    expect(BOARD_CSS).toContain("1080px");
    expect(BOARD_CSS).toContain("810px");
  });

  it("leads with the font @import, because @import must precede every rule", () => {
    expect(BOARD_CSS.trimStart().startsWith("@import")).toBe(true);
  });

  it("trails with the reduced-motion override, which must win over the rules above it", () => {
    expect(BOARD_CSS.trimEnd().endsWith("}")).toBe(true);
    expect(BOARD_CSS.lastIndexOf("prefers-reduced-motion")).toBeGreaterThan(
      BOARD_CSS.lastIndexOf(".fb-savernext"),
    );
  });

  it("has no unresolved template interpolation", () => {
    expect(BOARD_CSS).not.toContain("${");
  });
});
