import { useEffect, useState } from "react";

import { BUILD_SHA, BUILD_TIME } from "../../lib/build.js";
import { CANVAS_W, CANVAS_H, DEVICE_W, DEVICE_H } from "../../lib/canvas.js";

/*
  A readout of every quantity the board's geometry could depend on, and a
  colour probe that says which layer — if any — paints the grey band along the
  bottom of the board on the wall iPad.

  Why this file is the whole of this change.

  Eight passes tried to close that band. Every one of them tuned a number
  inside an assumed mechanism, and the mechanism was never established: the
  frame CSS has been back to its pass-2 declaration, two tuning tokens were
  created and deleted inside the same hour, and the two most recent passes
  wrote down contradictory root causes eleven minutes apart. What is actually
  known is one photograph, and it says three things:

    - The warm month gradient runs to the very top edge, behind the status bar.
      The web view is full-bleed at the top, so the artefact is
      bottom-asymmetric, and every symmetric inset shipped so far was wrong in
      kind rather than in magnitude.
    - The band is flat neutral grey. Neutral grey is in none of the board's
      palettes, and Safari's own default canvas is white.
    - 900x675 and 1080x810 are both exactly 4:3, so a correct uniform fit
      letterboxes to zero. The band existing at all means the effective
      viewport height is not the height the scale math assumes.

  There are exactly three mechanisms, and they are discrete rather than points
  on a scale:

    A. The page paints it — frame or letterbox background below a top-anchored
       scaled canvas.
    B. The web view is inset from the bottom and the page never receives those
       pixels — safe area, home indicator, or a standalone viewport quirk.
    C. iPadOS paints over the bottom of the web view.

  B and C are unreachable from CSS. No calc(), no inset, no dvh distinguishes
  them, which is why eight passes of arithmetic could not have found either.
  The colour probe below distinguishes all three in a single photograph, and
  the rows distinguish nothing but report everything, so the next pass starts
  from a measurement instead of a guess.

  This replaces a narrower version of the same idea. That one was reachable
  only through `?diag` — untypeable on a home-screen app with no address bar —
  then through Settings, and it tinted two layers with inline styles. Inline
  styles were the wrong mechanism twice over: React owns the `style` attribute
  on `.fb-root` (App.jsx's palette custom properties) and on `.fb-art` (the
  month gradient), so an imperative write to either is erased by the next
  render, and the board re-renders every minute on the clock tick. The probe
  here is an injected stylesheet with `!important`, which React cannot clobber
  and which outranks the inline styles it needs to override.
*/

/*
  The last measurement <Fit> took and the scale that fell out of it. Written by
  Fit.jsx on every measure; read here.

  Published rather than recomputed, because a recomputation is a different
  observation. The overlay's job is "what did the code decide, and from what" —
  calling the measurement again at overlay-open time could read a viewport the
  board is not currently scaled to, and that discrepancy is one of the things
  most worth being able to see.

  Lives here rather than in Fit.jsx so the import runs one way: Fit.jsx imports
  the recorder, DiagSurface.jsx imports the overlay, and nothing imports
  Fit.jsx back.
*/
export const fitSignals = {
  measured: null,
  candidates: null,
  fit: null,
  count: 0,
  at: null,
};

export function recordFitSignals(measurement, fit) {
  fitSignals.measured = { w: measurement.w, h: measurement.h };
  fitSignals.candidates = measurement.candidates;
  fitSignals.fit = fit;
  fitSignals.count += 1;
  fitSignals.at = typeof performance === "undefined" ? null : Math.round(performance.now());
}

/*
  Two decimal places, and an em dash for anything that is not a usable number.
  Rounding to whole pixels would hide exactly the sub-pixel residue that a
  fractional scale leaves on an edge, and `undefined` printed as a blank cell
  is indistinguishable from a zero in a photograph.
*/
const n = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : "—");

const pair = (w, h) => `${n(w)} x ${n(h)}`;

function el(selector) {
  if (typeof document === "undefined") return null;
  return document.querySelector(selector);
}

/*
  All four edges plus the size, not just the size. Which edge a discrepancy
  lands on is the entire question here: a 1080x790 box tells you nothing about
  whether the missing 20px are above the board or below it, and `b790` against
  a glass bottom at 810 tells you immediately.
*/
function rect(selector) {
  const node = el(selector);
  if (!node?.getBoundingClientRect) return "not in the DOM";
  const r = node.getBoundingClientRect();
  return `l${n(r.left)} t${n(r.top)} r${n(r.right)} b${n(r.bottom)}   ${pair(r.width, r.height)}`;
}

const SIDES = ["top", "right", "bottom", "left"];

/*
  The resolved safe-area insets, in px.

  These are the one quantity that describes the difference between the viewport
  and the glass, and the one thing none of Fit.jsx's JS signals can see — which
  makes them the direct test for mechanism B. If
  `env(safe-area-inset-bottom)` comes back as the height of the band, the page
  is being told about the inset and simply is not honouring it, and that is a
  one-line fix. If it comes back 0 while the band is there, the platform is not
  telling the page anything and the band is C.

  Measured, not parsed. There is no JS API for env(), and reading the CSS text
  back gives the literal string `env(safe-area-inset-bottom, 0px)` rather than
  its resolved value. So a throwaway element takes each inset as its `height`
  in turn and getBoundingClientRect reports what that resolved to — a used
  value, in px, from the layout engine rather than from the cascade.
*/
export function safeAreaInsets() {
  if (typeof document === "undefined" || !document.body) return {};
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  // Parked off-screen at a fixed position so it cannot scroll anything,
  // contribute overflow, or be seen for the frame it exists.
  probe.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;";
  document.body.appendChild(probe);
  const out = {};
  for (const side of SIDES) {
    probe.style.height = `env(safe-area-inset-${side}, 0px)`;
    out[side] = probe.getBoundingClientRect().height;
  }
  probe.remove();
  return out;
}

function backgroundOf(selector) {
  const node = selector === "html" ? document?.documentElement : el(selector);
  if (!node || typeof getComputedStyle === "undefined") return "—";
  const cs = getComputedStyle(node);
  const image = cs.backgroundImage && cs.backgroundImage !== "none" ? "  +image" : "";
  return `${cs.backgroundColor}${image}`;
}

const candidateList = (group) =>
  group
    ? Object.entries(group)
        .map(([name, value]) => `${name} ${n(value)}`)
        .join("  ")
    : "—";

/*
  Section headers are rows with an empty value. Both renderers below print
  `label + value`, so a header is just a label that pads out to nothing —
  no second code path, and the blank lines are what make thirty rows legible
  in a photograph rather than a wall of text.
*/
const HEAD = (label) => [label, ""];

export function diagRows() {
  if (typeof window === "undefined") return [];
  const doc = document.documentElement;
  const vv = window.visualViewport;
  const scr = window.screen;
  const insets = safeAreaInsets();
  const device = el(".fb-device");
  const { measured, candidates, fit, count, at } = fitSignals;

  return [
    HEAD("BUILD"),
    ["sha", BUILD_SHA],
    ["built", BUILD_TIME],

    HEAD("VIEWPORT"),
    ["window.inner", pair(window.innerWidth, window.innerHeight)],
    ["doc.client", pair(doc?.clientWidth, doc?.clientHeight)],
    ["visualViewport", vv ? pair(vv.width, vv.height) : "unsupported"],
    [
      "  vv detail",
      vv
        ? `scale ${n(vv.scale)}  offset ${n(vv.offsetLeft)},${n(vv.offsetTop)}  pageTop ${n(vv.pageTop)}`
        : "unsupported",
    ],
    ["screen", pair(scr?.width, scr?.height)],
    ["screen.avail", pair(scr?.availWidth, scr?.availHeight)],
    ["devicePixelRatio", n(window.devicePixelRatio)],
    ["nav.standalone", `${window.navigator?.standalone}`],
    ["display-mode", `${window.matchMedia?.("(display-mode: standalone)")?.matches}`],
    [
      "safe-area",
      `t ${n(insets.top)}  r ${n(insets.right)}  b ${n(insets.bottom)}  l ${n(insets.left)}`,
    ],

    HEAD("BOXES"),
    [".fb-fit", rect(".fb-fit")],
    [".fb-device", rect(".fb-device")],
    [".fb-root", rect(".fb-root")],
    [".fb-stage", rect(".fb-stage")],
    ["transform", device ? getComputedStyle(device).transform : "—"],

    HEAD("SCALE"),
    ["computed fit", fit ? `x ${n(fit.x)}  y ${n(fit.y)}  anchor ${fit.anchor}` : "not yet"],
    ["measured", measured ? pair(measured.w, measured.h) : "not yet"],
    ["measures", `${count}  last at ${n(at)}ms`],
    ["w signals", candidateList(candidates?.w)],
    ["h signals", candidateList(candidates?.h)],
    ["canvas const", pair(CANVAS_W, CANVAS_H)],
    ["device const", pair(DEVICE_W, DEVICE_H)],

    HEAD("PAINT"),
    ["html", backgroundOf("html")],
    ["body", backgroundOf("body")],
    [".fb-fit", backgroundOf(".fb-fit")],
    [".fb-root", backgroundOf(".fb-root")],
    [".fb-stage", backgroundOf(".fb-stage")],
    [".fb-art", backgroundOf(".fb-art")],
  ];
}

const PROBE_ID = "fb-colour-probe";

/*
  The mechanism test, in one photograph.

  Only two rules in the shipped stylesheet paint --frame-bg and they are the
  same #D9DBE0, so no stray edge can be attributed to either by looking at it.
  Under the probe every candidate layer is a different, unmistakable colour and
  every gradient above them is gone, so the band names its own owner:

    magenta    -> .fb-fit. The frame paints it, below a canvas short of the
                  frame.
    yellow     -> .fb-root. The canvas box reaches the bottom of the glass and
                  the board's own root is painting there.
    cyan       -> .fb-stage. Same, one layer in.
    orange     -> body, below a .fb-fit short of the viewport.
    lime       -> html's canvas, outside body's box entirely.

  Any of those five is mechanism A: the page owns the band, and the colour says
  which element, which makes it a one-element fix rather than a ninth guess.

    still neutral grey -> mechanism B or C. Nothing in the page paints it,
                  because every layer that could has been recoloured and none
                  of those colours appeared. The page either never receives
                  those pixels or does not get the last word on them, and all
                  eight prior passes were categorically misdirected — no CSS
                  length in this repository can move it.

  The last two rules are what make the colours readable at the bottom edge:
  `.fb-art` is the month gradient and would otherwise sit over the whole
  canvas, and the cards inside the stage paint their own solid fills over the
  very edge the photograph is of.

  An injected stylesheet rather than inline styles, and `!important` rather
  than specificity, both for the same reason: React owns the `style` attribute
  on `.fb-root` and `.fb-art`, the board re-renders every minute on the clock
  tick, and an inline write to either would be silently reverted somewhere
  inside the first minute of looking at it.
*/
const PROBE_CSS = `
html { background: lime !important; }
body { background: orange !important; }
.fb-fit { background: magenta !important; }
.fb-root { background: yellow !important; }
.fb-stage { background: cyan !important; }
.fb-art { display: none !important; }
.fb-stage *, .fb-root *::before, .fb-root *::after { background: transparent !important; }
`;

export function isColourProbeOn() {
  return typeof document !== "undefined" && Boolean(document.getElementById(PROBE_ID));
}

/*
  Idempotent in both directions, and it reports the state it left behind, so
  the two entry points — the corner gesture and the Settings button — can both
  drive it without either having to own the truth. The DOM is the state.
*/
export function setColourProbe(on) {
  if (typeof document === "undefined") return false;
  const existing = document.getElementById(PROBE_ID);
  if (on && !existing) {
    const style = document.createElement("style");
    style.id = PROBE_ID;
    style.textContent = PROBE_CSS;
    document.head.appendChild(style);
  } else if (!on && existing) {
    existing.remove();
  }
  return Boolean(on);
}

/*
  The full-screen readout.

  Opaque and covering, because it has to be photographed and a translucent
  overlay over a month gradient is not readable. Large bold monospace for the
  same reason: the useful artefact here is a phone photo of a wall-mounted
  iPad, not a screenshot on a desk.

  Everything is on one screen with no scrolling. Thirty-odd rows at 15px/1.45
  is about 610px of the panel's 810, which leaves room for the header and the
  buttons — and a readout that needs scrolling to be read completely is a
  readout that will be reported incompletely.
*/
export function FitDiag({ onClose, onProbe }) {
  const [rows, setRows] = useState(diagRows);

  useEffect(() => {
    // Re-read once layout has settled and again on anything that could move
    // the viewport. rAF rather than an immediate read because the rects are
    // the point of this and the overlay's own first commit is not painted yet.
    const read = () => setRows(diagRows());
    const raf = requestAnimationFrame(read);
    const settle = setTimeout(read, 600);
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483640,
        background: "#000",
        color: "#fff",
        padding: "10px 14px",
        font: "700 15px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 4 }}>
        <div style={{ fontSize: 24, letterSpacing: "-.01em" }}>{BUILD_SHA}</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{BUILD_TIME}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={BTN} onClick={() => setRows(diagRows())}>
            RE-READ
          </button>
          <button style={BTN} onClick={onProbe}>
            COLOUR PROBE
          </button>
          <button style={BTN} onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>

      {/*
        One pre-formatted block rather than a table: it is the layout that
        survives being photographed at an angle, and the label column lines up
        without anything having to measure anything.
      */}
      <div style={{ whiteSpace: "pre", columnGap: 24 }}>
        {rows.map(([label, value]) => `${label.padEnd(17)}${value}`).join("\n")}
      </div>
    </div>
  );
}

// 44px minimum on the short axis, like every other control on the board —
// these get tapped through Guided Access with no keyboard and no pointer.
const BTN = {
  font: "700 13px/1 ui-monospace, Menlo, monospace",
  color: "#000",
  background: "#fff",
  border: 0,
  borderRadius: 6,
  padding: "0 14px",
  minHeight: 44,
};
