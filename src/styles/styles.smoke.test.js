import { describe, it, expect } from "vitest";

import { BOARD_CSS } from "./index.js";
import { CANVAS_W, CANVAS_H } from "../lib/canvas.js";
import { TRACK_W } from "../lib/layout.js";
import fit from "./shell/Fit.js";
import root from "./shell/Root.js";
import header from "./shell/Header.js";
import headerControls from "./shell/HeaderControls.js";
import viewSwitcher from "./shell/ViewSwitcher.js";
import memberPicker from "./shell/MemberPicker.js";
import countdowns from "./shell/Countdowns.js";
import day from "./views/DayView.js";
import week from "./views/WeekView.js";
import month from "./views/MonthView.js";
import agenda from "./views/AgendaView.js";
import avatar from "./shell/Avatar.js";
import personProgress from "./shell/PersonProgress.js";
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
  it("still declares the canvas contract", () => {
    // Interpolated from canvas.js rather than written out, so resizing the
    // board (the 900x675 knob in that file) does not need this file edited —
    // it only needs the sheet to still be the place the contract lands.
    expect(BOARD_CSS).toContain(`${CANVAS_W}px`);
    expect(BOARD_CSS).toContain(`${CANVAS_H}px`);
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

  it("paints the page's own canvas with the board's paper, as the backstop", () => {
    /*
      The layer of last resort. The root element's background propagates to the
      canvas, which is the one surface painted outside the viewport's clip and
      therefore the only thing that covers the whole web view no matter what
      any box in the document resolves to. On the wall that region is the grey
      band this sequence has been chasing, and #59's colour probe photographed
      it as the page's own background rather than as something iPadOS drew —
      which is what made it fixable in CSS at all.

      --paper rather than --frame-bg, because a residual sub-pixel gap under a
      board whose own root is --paper should be invisible rather than a grey
      hairline. body is in the selector with it: the page's boxes now reach the
      glass, so an opaque grey body would sit on top of the backstop and defeat
      it.

      .fb-fit deliberately keeps --frame-bg. Inside the frame the grey is the
      dev window's device border and is meant to be seen.
    */
    expect(fit).toContain("html, body { background: var(--paper); }");
    expect(fit).toContain("background: var(--frame-bg)");
    // The whole chunk is hex-free (asserted below), so this only has to rule
    // out the frame grey being reused as the page background by token name.
    expect(fit).not.toContain("html, body { background: var(--frame-bg)");
  });

  it("keeps the frame a plain viewport box that cannot clip the canvas", () => {
    // Six passes of the grey band along the bottom of the board all lived in
    // this one rule, and they converged on the frame not being the place to
    // fix it: Fit.jsx pins the canvas to the panel's known height now, so the
    // frame is back to a plain `inset: 0` with no padding and no floor.
    expect(fit).toContain("height: calc(100% + env(safe-area-inset-bottom, 0px))");
    expect(fit).not.toContain("--fit-extend-b");
    expect(fit).not.toContain("100dvh");
    expect(fit).not.toContain("100vh");
    expect(fit).not.toContain("min-height");
    // The board's own drop shadow painted into the gap along the bottom once
    // .fb-fit stopped clipping it, tinting --frame-bg's #D9DBE0 toward
    // #B2B4B8 — darker and more visible than the grey it sits on. It was
    // decoration for a dev window and it is gone.
    expect(fit).not.toContain("box-shadow");
    // The one line that still matters. The canvas is DEVICE_H tall whatever
    // the frame resolves to, so a frame that comes up short must not clip it
    // — that would put the band straight back, the frame cutting off the
    // board that was covering the glass. .fb-device keeps its own clip.
    expect(fit).toMatch(/\.fb-fit \{[^}]*\}/);
    expect(fit.slice(fit.indexOf(".fb-fit"), fit.indexOf(".fb-device"))).not.toContain("overflow");
    expect(fit.slice(fit.indexOf(".fb-device"))).toContain("overflow: hidden");
    // `top` is set inline by Fit.jsx per anchor, so the sheet must not pin it.
    expect(fit.slice(fit.indexOf(".fb-device"))).not.toContain("top:");
  });

  it("derives the dock offset instead of restating it", () => {
    expect(BOARD_CSS).toContain("--dock-bottom: calc(var(--board-pad-b) + 8px)");
    expect(BOARD_CSS).not.toContain("bottom: 92px");
    // R7's DayView rewrite retired the axis-margin duplication (and the
    // .fb-axis it measured) along with the old lane-name column.
    expect(BOARD_CSS).not.toContain("164px");
    expect(BOARD_CSS).not.toContain("--axis-margin");
  });

  it("gives the scrim a definite column, which is the only thing that can cap the sheet", () => {
    // The scrim is the canvas (absolute, inset 0, inside .fb-root), so the
    // sheet has CANVAS_W minus two paddings to live in and .fb-root clips
    // whatever exceeds it. #61 tried to cap that with max-width: 100% alone
    // and it was a no-op: with no grid-template-columns the scrim's column
    // was an implicit `auto` track, auto tracks are sized *from their items*,
    // and a percentage max-width resolves against the grid area — so the
    // sheet's 900px set the track and then 100% came back as 900px.
    //
    // minmax(0, 1fr) is what makes the column a definite CANVAS_W - 2 * pad.
    // The minmax(0, ...) is load-bearing and must not be relaxed to a bare
    // 1fr: that means minmax(auto, 1fr), whose auto minimum floors the track
    // at the item's min-content contribution, which is the same 900px and
    // the same bug.
    const scrim = sheet.match(/\.fb-scrim \{[^}]*\}/)[0];
    expect(scrim).toContain("grid-template-columns: minmax(0, 1fr)");
    const pad = Number(scrim.match(/padding: (\d+)px/)[1]);
    expect(CANVAS_W - 2 * pad).toBeGreaterThan(0);

    // And with the track definite, these two are what land the sheet inside
    // it — a cap that now resolves, and a wide sheet that asks for the room
    // rather than naming a number that has to track the canvas by hand.
    expect(sheet.match(/\.fb-sheet \{[^}]*\}/)[0]).toContain("max-width: 100%");
    expect(sheet).toContain(".fb-sheet.is-wide { width: 100%; }");
    expect(sheet).not.toMatch(/\.fb-sheet\.is-wide \{ width: \d+px; \}/);
  });

  it("sizes the Family row's fields off the row, not off their own intrinsic widths", () => {
    // An avatar and six controls on one line. The two id fields flex, so the
    // row's width is the container's and no input's default 20-character
    // intrinsic size can push it past the edge at any sheet width.
    expect(sheet).toContain(
      ".fb-memberrow .fb-input-id { flex: 1 1 0; width: auto; min-width: 0; }",
    );
    // Small on purpose, and the smallest type in the sheet — see the comment
    // over these rules for what it buys and what it costs.
    expect(sheet).toContain(".fb-memberrow .fb-input { font-size: 11px;");
    expect(sheet).toContain(".fb-memberrow .fb-swatch { width: 30px;");
    // The shrink is scoped to this row: the sheet's shared controls keep the
    // sizes every other section is laid out against.
    expect(sheet).toContain(".fb-input-sm { width: auto; min-width: 108px; padding: 9px 11px;");
    expect(sheet).toContain(".fb-swatch {\n  width: 38px; height: 38px;");
  });

  it("gives .fb-stage no surface of its own, so nothing frames the calendar", () => {
    // The stage used to be a card: --paper fill, an 18px radius, and a
    // ::before washing --stage-art at .22 against .fb-art's .85 on the
    // board. On the wall that combination read as a grey border boxing the
    // calendar in on all four sides — measured off a 1080x810 render, board
    // #F5DBC6 against card #FAF9F7. The board's single .fb-art wash has to
    // stay the only one, running unbroken behind the calendar.
    const stage = countdowns.match(/\.fb-stage \{[^}]*\}/)[0];
    expect(stage).not.toContain("background");
    expect(stage).not.toContain("border-radius");
    expect(countdowns).not.toContain(".fb-stage::before");
    expect(BOARD_CSS).not.toContain("--stage-art");

    // The padding is a layout contract (TRACK_W below), not decoration, so
    // it survives the card — it just shows the same tinted board now.
    expect(stage).toContain("padding: 16px 18px");
    expect(stage).toContain("overflow: hidden");
  });

  it("keeps the three insets layout.js derives the event-column track from", () => {
    // src/lib/layout.js computes TRACK_W from these numbers rather than
    // measuring the DOM — the canvas is letterboxed, not responsive — and
    // enforces its min event-column width against the result. If any of them
    // moves here, overlaps start collapsing at the wrong depth with nothing
    // else to catch it.
    expect(root).toContain("padding: 22px 24px var(--board-pad-b)");
    expect(countdowns).toContain("padding: 16px 18px");
    expect(week).toContain(".fb-gutter { width: 56px;");
    expect(TRACK_W).toBe(CANVAS_W - 2 * 24 - 2 * 18 - 56);
  });

  it("clips event title and time text rather than letting it wrap", () => {
    // The backstop under the column-width maths: however narrow a block ends
    // up, its two text lines ellipse on one line instead of wrapping and
    // being sheared off mid-word by the block's duration-derived height.
    for (const rule of [".fb-wbtitle", ".fb-wbtime", ".fb-blocktitle", ".fb-blocktime"]) {
      const decl = (day + week).match(new RegExp(`\\${rule} \\{[^}]*\\}`))[0];
      expect(decl).toContain("white-space: nowrap");
      expect(decl).toContain("overflow: hidden");
      expect(decl).toContain("text-overflow: ellipsis");
      expect(decl).toContain("max-width: 100%");
    }
  });

  it("scopes every event surface that renders as a <button> past the reset", () => {
    /*
      Root.js's reset is `.fb-root button { font: inherit; color: inherit;
      background: none; ... }` — specificity (0,1,1), which outranks any bare
      single-class rule at (0,1,0). Three event surfaces ARE the button rather
      than a <span> inside one: SpanBar renders Month's bars and Week's
      all-day band as <button>, and DayView's all-day chips are buttons too.
      Styled bare, each silently lost every font longhand it declared (`font`
      is a shorthand, so `font: inherit` takes size, weight and line-height
      with it) plus its background and ink — Month's bars shipped at the
      inherited 16px/400, a different and much larger face than the titles
      beside them in Day and Week, and Day's chips shipped with no fill at all.

      So each must stay scoped by a parent to clear (0,1,1). Day's and Week's
      timed titles are exempt: .fb-blocktitle and .fb-wbtitle are <span>s,
      which the reset never matches.
    */
    expect(month).toContain(".fb-rowevents .fb-cellev {");
    expect(month).toContain(".fb-rowevents .fb-cellmore {");
    expect(week).toContain(".fb-alldaytrack .fb-alldaychip {");
    expect(day).toContain(".fb-allday .fb-alldaychip {");
    // The trap itself, so this test keeps pointing at something real.
    expect(root).toContain(".fb-root button { font: inherit;");
  });

  it("steps event type down from Day to Week to Month", () => {
    // Canvas px, which <Fit> then upscales, so the ladder is the invariant
    // rather than any absolute number: a Day block has the most room to spend
    // and a Month bar the least, so the type gets smaller in that order.
    const sizeOf = (sheet, rule) =>
      Number(sheet.match(new RegExp(`\\${rule} \\{[^}]*font-size: (\\d+)px`))[1]);

    const dayTitle = sizeOf(day, ".fb-blocktitle");
    const weekTitle = sizeOf(week, ".fb-wbtitle");
    const monthBar = sizeOf(month, ".fb-rowevents .fb-cellev");

    expect(dayTitle).toBeGreaterThan(weekTitle);
    expect(weekTitle).toBeGreaterThan(monthBar);
  });

  it("has no hardcoded colour literal outside tokens.js", () => {
    // fit.js is the one chunk with a JS literal at all — CANVAS_W/CANVAS_H
    // interpolated from src/lib/canvas.js — and its only string literal is
    // the Archivo @import URL, not a colour.
    const everythingElse = [
      root,
      header,
      headerControls,
      viewSwitcher,
      memberPicker,
      countdowns,
      day,
      week,
      month,
      agenda,
      avatar,
      personProgress,
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
