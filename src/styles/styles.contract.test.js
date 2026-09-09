import { describe, it, expect } from "vitest";

import { BOARD_CSS } from "./index.js";

/*
  R2's byte-identical assertion against the prototype fixture lived here
  through R2's zero-behaviour-change decomposition — its own docstring said
  so: "R5 ... delete it then, deliberately, in the same commit that lands the
  replacement. Do not delete it to make a red suite green." R7 is that commit,
  just not via R5's route: rotating DayView (PLAN.md §R7 item 1) is a real
  layout change, not a token/CSS-module swap, but it is the first legitimate
  post-R2 change to touch a styles/*.js chunk, so the same retirement applies
  — a byte-for-byte pin against the original prototype cannot coexist with any
  role whose mandate is to change what the board looks like. The structural
  checks below (canvas contract, import order, cascade order, no stray
  interpolation) don't pin exact bytes and stay meaningful after this and
  every future styles change.
*/

describe("board stylesheet", () => {
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
