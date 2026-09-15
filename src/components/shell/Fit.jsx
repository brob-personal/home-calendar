import { useState, useEffect, useRef } from "react";

import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";
import { DiagSurface } from "./DiagSurface.jsx";
// The scale and the signals behind it are recorded for the diagnostic overlay
// rather than recomputed by it — see recordFitSignals' comment for why a
// second measurement would not be the same observation. safeAreaInsets is the
// probe #57 built to read env() back from the layout engine; the glass
// derivation below is the first thing outside the overlay to need it.
import { recordFitSignals, safeAreaInsets } from "./FitDiag.jsx";

/*
  Maps the fixed 900x675 canvas onto the frame it lands in. Every dimension
  downstream is tuned to that canvas and nothing has a responsive breakpoint,
  so the board is scaled, never reflowed.

  The wall iPad (7th gen / A2197) is 2160x1620 native, so its standalone
  landscape viewport is 1080x810 CSS px. The canvas is that divided by 1.2
  and still exactly 4:3 (src/lib/canvas.js), so on the device this resolves to
  a uniform 1.2x on both axes — flush to all four edges, nothing cropped,
  nothing stretched. It used to be the device's own 1080x810 and resolve to
  1:1; the canvas shrank so the board would render 20% larger on the wall, and
  this file did not have to change to do it. That is the point of it.

  Two properties do the work here, and both predate the current pass:

  1. Measure the frame rather than assume it. The canvas has to cover the box
     it actually lands in, and the only way to be exact about that is to
     measure. Eight passes' worth of history in this file (and in
     src/styles/shell/Fit.js) is really one long argument about *which*
     measurement — and measureFrame below now settles the height with a number
     that comes from the device's glass instead of from its layout viewport.

  2. Cover both axes instead of `Math.min` on one. A single uniform scale
     letterboxes the moment the frame is not exactly 4:3, and it never quite
     is — anything that shaves a row of pixels off the height drops the scale
     below 1 and opens --frame-bg down both sides. That was the left and
     right of the reported border. Near the canvas aspect each axis gets its
     own scale, so both cover, and the canvas is flush on all four edges:
     nothing cropped, no gap to fill.

  Off-aspect frames (a laptop browser during development) keep the uniform
  contain-fit and the letterboxed device look, centred, because there the grey
  is deliberate — stretching the board to 16:9 would make the dev preview lie
  about the real layout.

  FILL_TOLERANCE is what separates "this frame is device-shaped, cover it"
  from "this is a desktop window, letterbox it": 15% covers the wall iPad
  standalone (0% off-aspect) and the same device in a Safari tab (~11%), and
  excludes every normal desktop window. It no longer decides anything about
  *which* height is used — glassAgrees does that, and it can tell a
  home-screen app from a tab, which an aspect ratio never could.

  Deliberately not window.visualViewport: iOS shrinks that when the on-screen
  keyboard opens, which would rescale the whole board every time Composer,
  Settings or a note took focus. A fixed `inset: 0` box ignores the keyboard
  for the same reason.

  The resize/orientationchange listeners are what re-measure. A ResizeObserver
  on .fb-fit would also fire — the box tracks the viewport now — but the
  window events are the cause rather than the effect, and jsdom reports them.
*/
const FILL_TOLERANCE = 0.15;

/*
  Whether the page is running as an installed home-screen app.

  navigator.standalone first and matchMedia second, which is the reverse of the
  usual advice and is the measured order rather than the fashionable one. On
  the wall iPad (build c5ad5f3) the overlay read:

    navigator.standalone                      true
    matchMedia('(display-mode: standalone)')  false

  So on the one device this board ships on, the standard query is wrong and the
  legacy Safari property is right. Anything gated on display-mode alone can
  never fire here, which is worth knowing about any future branch written
  against it. matchMedia stays as the fallback for engines that do not
  implement navigator.standalone at all — where `undefined` is an absence of
  information rather than an answer of "no" — and that ordering is the whole of
  it: prefer the signal known to be correct on the target hardware, fall back
  to the one that is correct in the standard.
*/
function isStandalone() {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.standalone === "boolean") return navigator.standalone;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true;
}

/*
  The agreement test, and the reason this pass is a fix rather than a ninth
  guess.

  What the device reported (build c5ad5f3, iPad 7th gen A2197, standalone,
  landscape) is that every JS height API agrees on 790 —

    window.innerHeight   790
    doc.clientHeight     790
    visualViewport       790
    .fb-fit rect         790

  — while two signals that are not viewport APIs say 810:

    screen.availHeight   810
    safe-area-inset-top   20

  and 790 + 20 = 810 exactly. iPadOS renders the standalone web view
  full-bleed from the top of the glass but reports a layout viewport short by
  precisely the top inset. That is why the previous passes could not find
  this: they were all reading, more and more carefully, the same wrong number.
  The largest of four copies of 790 is 790.

  So the height comes from screen.availHeight — but only when the two
  witnesses corroborate each other. That test is load-bearing and must not be
  relaxed into a bare `availH > innerH`:

    - If a future iPadOS fixes this upstream and reports innerHeight ==
      availHeight, `availH > innerH` is false, the glass is not used, and
      behaviour is identical to the pass before this one.
    - If the two disagree by anything other than the insets, the premise
      underneath the derivation does not hold on that device, and the code
      falls back to the viewport rather than acting on an unvalidated number.
    - Outside a home-screen app there is no claim being made about the glass
      at all — a Safari tab is legitimately shorter than the screen, because
      the browser chrome really is there — so `standalone` gates the lot.

  The +1 is float slack on a sum of resolved CSS px, not a tuning knob: it
  admits 20.0 against 19.999 and nothing a real inset could hide inside.

  Exported so Fit.test.jsx can drive the cases that matter without a device:
  a plain tab, absent insets, witnesses that disagree, and this panel's exact
  signature.
*/
export function glassAgrees({ standalone, innerH, availH, insetSum }) {
  return (
    standalone === true &&
    Number.isFinite(innerH) &&
    Number.isFinite(availH) &&
    Number.isFinite(insetSum) &&
    availH > innerH &&
    availH - innerH <= insetSum + 1
  );
}

/*
  The frame height the canvas is scaled against: the glass when the two
  witnesses agree, the layout viewport otherwise.

  There is no third option and no arithmetic beyond the choice. The number
  returned is always one of the two measurements — never a blend of them, never
  one of them with a correction applied, and never a constant. That is the
  property that separates this from the eight passes before it, and it is why
  there is no tuning token in this file any more.
*/
export function frameHeight({ standalone, innerH, availH, insetSum }) {
  return glassAgrees({ standalone, innerH, availH, insetSum }) ? availH : innerH;
}

/*
  Exported for Fit.test.jsx: the mapping is worth asserting without a render
  in the way. Returns the per-axis scales plus where the canvas is anchored in
  the frame; equal scales mean a uniform letterboxed fit.
*/
export function fitFor(width, height) {
  // A zero on either axis means there is nothing trustworthy to scale
  // against yet. 1:1 is the device's own answer, so it is the safe guess.
  if (!width || !height) return { x: 1, y: 1, anchor: "center" };
  const sx = width / CANVAS_W;
  const sy = height / CANVAS_H;
  if (Math.abs(sx / sy - 1) <= FILL_TOLERANCE) {
    /*
      Device-shaped frame: cover it on both axes, at exactly the scale the
      measurement implies.

      There is no clamp here and its absence is the point. The previous pass
      wrapped this in `Math.max(sy, DEVICE_H / CANVAS_H)` — a floor forcing the
      scale past a measurement the code had no reason to trust. Now that the
      height is derived from the glass, that floor is arithmetically a no-op on
      the target panel (810/675 is exactly 1.2, which is the floor's value), so
      keeping it would buy nothing and cost the only thing that matters: a
      floor silently absorbs the next measurement that comes up short, which is
      exactly the failure this whole sequence has been. If the derivation ever
      breaks, the board must visibly shrink and the overlay's glass check must
      read FAIL — not be papered over for another eight passes.

      The canvas stays anchored to the top of the frame. .fb-fit is `top: 0`
      and the web view is full-bleed from the top of the glass, so starting the
      canvas at the frame's top edge starts it on the glass's top edge, and any
      residual discrepancy lands off the bottom rather than being split across
      both edges.
    */
    return { x: sx, y: sy, anchor: "top" };
  }
  const s = Math.min(sx, sy);
  return { x: s, y: s, anchor: "center" };
}

/*
  The largest of a set of candidates, ignoring the ones that are not usable
  numbers. Zeroes and undefineds are what jsdom, a pre-layout browser and an
  unsupported API all return, and none of them is evidence of a small screen.
*/
function largest(candidates) {
  const usable = candidates.filter((n) => Number.isFinite(n) && n > 0);
  return usable.length ? Math.max(...usable) : 0;
}

/*
  What the canvas has to cover, per axis — measured two different ways,
  because the two axes have two different problems.

  Width is reduced with `max` over every signal the platform offers, and that
  is unchanged. It has been correct at every step of this: 1080 across the
  rect, innerWidth and clientWidth, with no shortfall anywhere. `max` over
  signals that agree is just a safe way of reading one of them, and it is what
  keeps a genuinely narrower panel from being cropped.

  Height is derived, not reduced. `max` was the previous pass's answer here
  and it could not have worked: all four height signals are descriptions of
  the same layout viewport, and the layout viewport is itself the thing
  reporting short, so the largest of four copies of 790 is 790. The two
  signals that know better are screen.availHeight and the safe-area insets —
  see glassAgrees.

  visualViewport stays in the reported candidates but no longer feeds the
  value, which resolves the standing objection to it: it shrinks when the iOS
  keyboard opens, and a height that read it could rescale the whole board
  whenever Composer or a note took focus.
*/
function measureFrame(el) {
  const r = el?.getBoundingClientRect();
  if (typeof window === "undefined") {
    return { w: r?.width ?? 0, h: r?.height ?? 0, candidates: null, glass: null };
  }
  const doc = document.documentElement;

  const innerH = window.innerHeight;
  const availH = window.screen?.availHeight ?? 0;
  // Measured through the layout engine, not parsed out of CSS text: there is
  // no JS API for env(), and reading the declaration back gives the literal
  // string rather than its resolved value. safeAreaInsets is the probe #57
  // built for exactly this, and this is the first non-diagnostic caller.
  const insets = safeAreaInsets();
  const insetSum = (insets.top ?? 0) + (insets.bottom ?? 0);
  const standalone = isStandalone();
  const glass = {
    standalone,
    innerH,
    availH,
    insetSum,
    useGlass: glassAgrees({ standalone, innerH, availH, insetSum }),
  };

  // Named rather than passed to largest() as a bare array literal, so the
  // diagnostic overlay can print the individual signals beside the value that
  // was used. Object.values preserves insertion order, so the list largest()
  // sees is the same list in the same order it saw before.
  const candidates = {
    w: { rect: r?.width, innerWidth: window.innerWidth, clientWidth: doc?.clientWidth },
    h: {
      rect: r?.height,
      innerHeight: innerH,
      clientHeight: doc?.clientHeight,
      visualViewport: window.visualViewport?.height,
      availHeight: availH,
      insetSum,
    },
  };
  return {
    w: largest(Object.values(candidates.w)),
    h: frameHeight({ standalone, innerH, availH, insetSum }),
    candidates,
    glass,
  };
}

export function Fit({ children }) {
  const ref = useRef(null);
  // Seeded from the initialiser rather than an effect so the first paint is
  // already at the right scale instead of flashing through scale 1. The ref
  // is still empty here, so this is the window fallback on mount; the effect
  // below re-measures against the real box immediately after.
  const [fit, setFit] = useState(() => {
    const { w, h } = measureFrame(null);
    return fitFor(w, h);
  });

  useEffect(() => {
    const measure = () => {
      const m = measureFrame(ref.current);
      const { w, h } = m;
      const next = fitFor(w, h);
      recordFitSignals(m, next);
      // Returning prev on an identical measurement keeps a resize burst from
      // re-rendering the whole board for nothing.
      setFit((prev) =>
        prev.x === next.x && prev.y === next.y && prev.anchor === next.anchor ? prev : next,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  // One argument while the axes agree, so the letterboxed case stays readable
  // in the inspector and reads as the uniform scale it is.
  const scale = fit.x === fit.y ? `scale(${fit.x})` : `scale(${fit.x}, ${fit.y})`;

  return (
    <div className="fb-fit" ref={ref}>
      {/*
        The build badge and the diagnostic gesture. Always mounted — the badge
        is meant to be on screen in every photograph of the wall, and the
        gesture is the only way to reach the overlay on a device with no
        address bar.

        Inside .fb-fit and outside .fb-device, and both halves of that matter.
        Outside .fb-device because it reports the numbers the canvas is scaled
        against and must not itself be scaled by them — and because a transform
        makes its subtree the containing block for `position: fixed`
        descendants, so a badge mounted in there would be pinned to the canvas
        rather than to the glass, which is the one thing it exists to tell
        apart. Inside .fb-fit because .fb-fit carries no transform, so fixed
        positioning there still resolves against the viewport.
      */}
      <DiagSurface />
      {/*
        scale() before translate() is load-bearing. The transform list
        composes as scale x translate, so the offsets are scaled with it, per
        axis, and the canvas lands where the anchor says at any scale. Written
        translate-first it would only be right at scale 1.

        The vertical anchor decides which edge a frame/glass discrepancy lands
        on. On a device-shaped frame the canvas is anchored to the top: the web
        view is full-bleed from the top of the glass and the frame is `top: 0`,
        so the canvas starts on the glass's top edge and — scaled to the
        derived glass height — ends on its bottom edge. Centring it there
        instead would split any difference across both edges, which is how
        earlier passes ended up with grey below the board *and* the header
        clipped above it.

        The letterboxed dev window keeps centring, because there the grey is
        deliberate and symmetry is what makes it read as a device frame.
      */}
      <div
        className="fb-device"
        style={{
          top: fit.anchor === "top" ? 0 : "50%",
          transform: `${scale} translate(-50%, ${fit.anchor === "top" ? "0" : "-50%"})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
