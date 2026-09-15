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

  It worked. The probe photographed the band as the page's own background,
  which ruled out C; #58 found the layout viewport reporting 20px short of the
  glass, and #59 gave the frame and the page's own boxes the derived height
  rather than `height: 100%`. The glass check reads PASS, delta 0 on the wall.
  The account above is left as written because it is the reasoning that ended
  a nine-pass sequence, and because the probe is still the fastest way to
  answer the same question if an edge ever comes back.

  How it is reached has been through three versions: `?diag`, untypeable on a
  home-screen app with no address bar; then a corner tap gesture and an
  always-on build badge, retired in #60 with the band that justified them; and
  now Settings -> Display diagnostics, which was there the whole time and is
  the one entry point that never needed to be discovered. The first version
  also tinted two layers with inline styles. Inline
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
  the recorder, Settings.jsx imports the readout, and nothing imports Fit.jsx
  back.
*/
export const fitSignals = {
  measured: null,
  candidates: null,
  // The inputs to the glass derivation and the boolean that fell out of them.
  // Recorded rather than re-derived for the same reason as the rest: whether
  // the two witnesses agreed *at the moment the board was scaled* is the
  // question, and a fresh read at overlay-open time is a different one.
  glass: null,
  fit: null,
  count: 0,
  at: null,
};

export function recordFitSignals(measurement, fit) {
  fitSignals.measured = { w: measurement.w, h: measurement.h };
  fitSignals.candidates = measurement.candidates;
  fitSignals.glass = measurement.glass ?? null;
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

/*
  The one assertion in this overlay that looks at the device instead of at the
  code, and the reason it replaces the invariant the tests used to carry.

  For eight passes the property under test was internal: "the canvas covers the
  frame on both axes". It stayed green the whole time the band was on screen,
  because it is satisfied just as well by a frame that is short of the glass as
  by one that is not — both sides of the comparison came from the same wrong
  number. Nothing self-consistent can catch that.

  This compares the two quantities that cannot both be wrong in the same
  direction: where .fb-fit's bottom edge actually is, and how tall the glass
  says it is. PASS means they coincide — the page's own frame reaches the
  bottom of the screen. FAIL means it does not, and the delta is the size of
  the discrepancy in CSS px, which at devicePixelRatio 2 is half the band in a
  photograph. That is a number to act on rather than a symptom to re-guess.

  UNKNOWN rather than PASS when either side is missing: screen.availHeight is
  0 in jsdom and absent in older engines, and `0 - 0 === 0` would otherwise
  print a green PASS everywhere the check cannot actually run — the exact class
  of false reassurance this row exists to end.
*/
function glassCheck() {
  const node = el(".fb-fit");
  const bottom = node?.getBoundingClientRect ? node.getBoundingClientRect().bottom : undefined;
  const availH = typeof window === "undefined" ? undefined : window.screen?.availHeight;
  const head = `fb-fit.bottom ${n(bottom)}  availHeight ${n(availH)}`;
  if (!Number.isFinite(bottom) || !Number.isFinite(availH) || availH <= 0) {
    return `${head}  delta —  UNKNOWN`;
  }
  const delta = availH - bottom;
  return `${head}  delta ${n(delta)}  ${delta === 0 ? "PASS" : "FAIL"}`;
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
    // Which inset is being asked about, recorded on the element rather than
    // left implicit in the loop. `env()` is not a value any height parser
    // accepts outside a real layout engine — jsdom drops the assignment
    // entirely — so the style attribute cannot be read back to find out, and a
    // probe that cannot say what it is measuring cannot be tested or watched
    // in an inspector. Fit.test.jsx keys its inset fixture off this.
    probe.dataset.fbInset = side;
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
  const { measured, candidates, glass, fit, count, at } = fitSignals;

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
    ["glass check", glassCheck()],

    HEAD("SCALE"),
    ["computed fit", fit ? `x ${n(fit.x)}  y ${n(fit.y)}  anchor ${fit.anchor}` : "not yet"],
    ["measured", measured ? pair(measured.w, measured.h) : "not yet"],
    ["measures", `${count}  last at ${n(at)}ms`],
    ["w signals", candidateList(candidates?.w)],
    ["h signals", candidateList(candidates?.h)],
    // The height derivation's own inputs and verdict, as they were when the
    // board was scaled. If `glass` is false while the check above reads FAIL,
    // the two witnesses did not corroborate and the code deliberately fell
    // back to the viewport — which is a different problem from the derivation
    // being applied and still coming up short.
    [
      "glass derive",
      glass
        ? `standalone ${glass.standalone}  inner ${n(glass.innerH)}  ` +
          `avail ${n(glass.availH)}  insets ${n(glass.insetSum)}  glass ${glass.useGlass}`
        : "not yet",
    ],
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
  The full-screen overlay that used to live here is gone, along with the corner
  tap gesture that was its only way in (#60). It existed because the wall board
  has no address bar and no keyboard, so a readout that had to be photographed
  from a step ladder needed to be large, opaque and reachable from a tap — and
  because the grey band along the bottom of the board had survived eight fixes
  and nothing on screen said which build was being looked at.

  That band is fixed. What is left in this file is the instrumentation rather
  than the presentation: diagRows is the payload, safeAreaInsets and
  recordFitSignals are the two readings that only this module knows how to
  take, and setColourProbe still names every layer that could paint an edge.
  Settings -> Display diagnostics renders all of it, which is a second entry
  point that was always there and does not require a gesture to be discovered.

  If a board on a wall ever needs the photographable version back, it is in the
  history at f54ab69 — but bring back the readout, not the always-on badge.
*/
