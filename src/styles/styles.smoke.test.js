import { describe, it, expect } from "vitest";

import { BOARD_CSS } from "./index.js";
import fit from "./shell/Fit.js";
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
  Replaces styles.contract.test.js, which asserted BOARD_CSS was
  byte-identical to family-board.jsx's original CSS string — R2's
  regression guard for a mechanical split that changed no values. That
  comparison stopped being meaningful once R5 replaced the per-chunk
  literals with tokens.js custom properties, so it's deleted rather than
  chased. (R7 independently reached the same call when rotating DayView —
  see the merge of role/r7-dayview — and left an equivalent four-check file
  under the same name; this version wins because it also covers the token
  contract below.) The invariants that follow are the ones that still hold:
  the canvas contract, cascade order, "no leftover template interpolation,"
  plus new coverage for tokens.js itself.
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

  it("declares the 60/30/10 tokens and reserves --now for the current-time line", () => {
    expect(BOARD_CSS).toContain("--paper:");
    expect(BOARD_CSS).toContain("--surface:");
    expect(BOARD_CSS).toContain("--now:");
    expect(BOARD_CSS).toContain("--tap-min: 44px");
  });

  it("raises every selector on R12's 44pt audit to --tap-min", () => {
    // tap-target-audit.md's six gaps: .fb-pen, .fb-width, .fb-notenav /
    // .fb-noteclose, .fb-shade, .fb-icon. Each now reaches --tap-min in the
    // dimension(s) that were short.
    expect(notes).toContain(".fb-pen { display: grid; place-items: center; width: var(--tap-min); height: var(--tap-min);");
    expect(notes).toContain(".fb-width { display: grid; place-items: center; width: var(--tap-min); height: var(--tap-min);");
    expect(notes).toContain(".fb-notenav, .fb-noteclose {");
    expect(notes).toMatch(/\.fb-notenav, \.fb-noteclose \{\s*display: grid; place-items: center; width: var\(--tap-min\); height: var\(--tap-min\);/);
    expect(sheet).toContain(".fb-shade { width: 48px; height: var(--tap-min);");
    expect(header).toContain(".fb-icon {");
    expect(header).toMatch(/\.fb-icon \{\s*display: grid; place-items: center; width: var\(--tap-min\); height: var\(--tap-min\);/);
  });

  it("keeps EventDetailSheet's danger colours as their own tokens, not aliases of --now", () => {
    expect(BOARD_CSS).toContain("--danger-bg:");
    expect(BOARD_CSS).toContain("--danger-ink:");
    expect(day + sheet).not.toMatch(/#C43A33|#E0574F/i);
  });

  it("derives the dock offset instead of restating it", () => {
    expect(BOARD_CSS).toContain(
      "--dock-bottom: calc(var(--footer-h) + var(--board-gap) + var(--board-pad-b))",
    );
    expect(BOARD_CSS).not.toContain("bottom: 92px");
    // R7's DayView rewrite retired the axis-margin duplication (and the
    // .fb-axis it measured) along with the old lane-name column.
    expect(BOARD_CSS).not.toContain("164px");
    expect(BOARD_CSS).not.toContain("--axis-margin");
  });

  it("has no hardcoded colour literal outside tokens.js", () => {
    // fit.js is the one chunk with a JS literal at all — CANVAS_W/CANVAS_H
    // interpolated from src/lib/canvas.js — and its only string literal is
    // the Archivo @import URL, not a colour.
    const everythingElse = [
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
    ].join("");
    expect(everythingElse).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
    expect(everythingElse).not.toMatch(/rgba?\(/);
    expect(fit).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
    expect(fit).not.toMatch(/rgba?\(/);
  });
});
