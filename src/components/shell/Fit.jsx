import { useState, useEffect, useRef } from "react";

import { CANVAS_W, CANVAS_H, DEVICE_H } from "../../lib/canvas.js";
import { DiagSurface } from "./DiagSurface.jsx";
// The scale and the signals behind it are recorded for the diagnostic overlay
// rather than recomputed by it — see recordFitSignals' comment for why a
// second measurement would not be the same observation.
import { recordFitSignals } from "./FitDiag.jsx";

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

  Two changes here finished off the grey border that framed the board on the
  device, after the previous pass (see src/styles/shell/Fit.js for the full
  history) had removed the top sliver and the corner wedges. Both still carry
  their weight at 1.2x — a covering scale needs the frame measured exactly as
  much as a 1:1 one did:

  1. Measure .fb-fit, not the window. It is the box the canvas actually has
     to cover, and measuring the thing you must cover is what makes covering
     it exact. The previous version instead set .fb-fit's own height from
     window.innerHeight; when innerHeight came back 20px short of the screen
     under viewport-fit=cover, the frame ended 20px above the bottom edge and
     body's identical grey showed through beneath it. getBoundingClientRect
     was rejected on the pass before that for measuring a `100dvh` box
     against a `height: 100%` parent — two disagreeing height sources — and
     that objection went away when the frame stopped carrying a height of its
     own. window.innerWidth/innerHeight stays as the fallback for when the
     rect is unmeasurable (jsdom, and the first paint before layout).

     Only the width reads that measurement now. See DEVICE_SCALE_Y below for
     why the height does not, and why six attempts at measuring it better
     were six attempts at the wrong thing.

  2. Cover both axes instead of `Math.min` on one. A single uniform scale
     letterboxes the moment the frame is not exactly 4:3, and it never quite
     is — anything that shaves a row of pixels off the height drops the scale
     below 1 and opens --frame-bg down both sides. That was the left and
     right of the reported border. Near the canvas aspect each axis gets its
     own scale, so the width covers the frame while the height is pinned, and
     the canvas is flush on all four edges: nothing cropped, no gap to fill.

  Off-aspect frames (a laptop browser during development) keep the uniform
  contain-fit and the letterboxed device look, centred, because there the grey
  is deliberate — stretching the board to 16:9, or pinning its height to a
  panel that is not there, would make the dev preview lie about the real
  layout.

  FILL_TOLERANCE is what separates "this is the wall iPad, near enough" from
  "this is a desktop window": 15% covers the device standalone (0% off-aspect)
  and the same device in a Safari tab (~11%), and excludes every normal
  desktop window. It carries more weight than it used to — it now decides
  whether the height is pinned to the panel or fitted to the frame — and the
  Safari tab falling inside it is a deliberate trade, written down in
  Fit.test.jsx: a tab gets the pin too, so the board's bottom runs under the
  browser chrome rather than leaving grey. Nothing can tell "short because
  Safari chrome" from "short because iPadOS under-reports the glass" by
  measuring, and the standalone board is the supported one.

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
  The vertical scale on a device-shaped frame. Not measured, and that is the
  entire point of this constant.

  Six passes tried to make the board reach the bottom of the glass by
  measuring the viewport more carefully, then by overshooting whatever the
  measurement returned. The overshoot did close the grey band and immediately
  produced the opposite failure: the canvas is scaled to cover the frame, so a
  frame 40px taller than the screen scales the board 40px past the screen and
  the bottom of the calendar and the note FAB fall off the glass. Those two
  outcomes are not two bugs to be balanced against each other with a better
  number — they are the same bug. As long as the vertical scale comes from a
  measurement, covering the glass and not overshooting it are in direct
  conflict, and no value of an extension resolves that.

  The screen height is not actually unknown, which is what makes this
  avoidable: the wall iPad is 2160x1620 native at 2x, so the glass is exactly
  DEVICE_H = 810 CSS px, and the canvas scaled by 810/675 is exactly 810
  screen px tall. Pin it there, anchor it to the top of the frame, and the
  board lands on the glass edge to edge by construction — no measurement to
  come up short, nothing to overshoot, nothing to tune.

  The width stays measured. It has been correct at every step (1080 -> 1.2x),
  a landscape iPad is the one dimension the layout viewport reports honestly
  here, and measuring it is what keeps a different panel from being cropped.
*/
const DEVICE_SCALE_Y = DEVICE_H / CANVAS_H;

/*
  Exported for Fit.test.jsx: the whole fix is in this mapping and it is worth
  asserting without a render in the way. Returns the per-axis scales plus
  where the canvas is anchored in the frame; equal scales mean a uniform
  letterboxed fit.
*/
export function fitFor(width, height) {
  // A zero on either axis means there is nothing trustworthy to scale
  // against yet. 1:1 is the device's own answer, so it is the safe guess.
  if (!width || !height) return { x: 1, y: 1, anchor: "center" };
  const sx = width / CANVAS_W;
  const sy = height / CANVAS_H;
  if (Math.abs(sx / sy - 1) <= FILL_TOLERANCE) {
    // Device-shaped frame: this is the wall iPad, so DEVICE_H is a floor
    // under the measured height rather than a replacement for it. Pinning it
    // outright was pass 7 and it is still the right answer when every signal
    // reports short; what it could not handle is a glass that is *taller*
    // than the constant, which would leave exactly the band being reported.
    // `max` covers both: short signals cannot shrink the board below the
    // panel, and an honest larger measurement is still allowed to grow it.
    //
    // The canvas stays anchored to the top of the frame, so whichever of the
    // two wins, the discrepancy lands off the bottom edge rather than being
    // split across the top and bottom.
    return { x: sx, y: Math.max(sy, DEVICE_SCALE_Y), anchor: "top" };
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
  Every way the platform will tell us how big the viewport is, reduced with
  `max` rather than by picking a favourite.

  This file has picked a favourite three times — getBoundingClientRect on a
  CSS-sized box, then window.innerHeight, then the rect of a `position: fixed;
  inset: 0` box — and the grey band along the bottom survived all three. Each
  choice was defensible and each one can come up short of the glass; what none
  of them can do is come up *too large*, because they are all descriptions of
  the same viewport. So there is nothing to lose by taking whichever reports
  the most and everything to gain: the board can only be too small if *every*
  signal is short, rather than if the one that was picked is.

  visualViewport is in the list for the same reason it was once deliberately
  excluded. It shrinks when the iOS keyboard opens, which is why scaling to it
  would rescale the whole board whenever Composer or a note took focus — but
  under `max` a shrunken visualViewport is simply never the largest, so it can
  contribute its (occasionally larger) value without being able to shrink
  anything.
*/
function measureFrame(el) {
  const r = el?.getBoundingClientRect();
  if (typeof window === "undefined") {
    return { w: r?.width ?? 0, h: r?.height ?? 0, candidates: null };
  }
  const doc = document.documentElement;
  // Named rather than passed to largest() as a bare array literal, so the
  // diagnostic overlay can print the individual signals beside the value that
  // won. Object.values preserves insertion order, so the list largest() sees
  // is the same list in the same order it saw before.
  const candidates = {
    w: { rect: r?.width, innerWidth: window.innerWidth, clientWidth: doc?.clientWidth },
    h: {
      rect: r?.height,
      innerHeight: window.innerHeight,
      clientHeight: doc?.clientHeight,
      visualViewport: window.visualViewport?.height,
    },
  };
  return {
    w: largest(Object.values(candidates.w)),
    h: largest(Object.values(candidates.h)),
    candidates,
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

        The vertical anchor is the fix for the band along the bottom. On a
        device-shaped frame the canvas is pinned to the top: its height is
        DEVICE_H by construction, so starting it at the frame's top edge — and
        the frame is `top: 0` — puts its bottom edge exactly on the bottom of
        the glass. Centring it there instead would split any difference
        between the frame and the glass across both edges, which is how six
        passes of this ended up with grey below the board, or with the
        calendar's last row and the note FAB pushed off the screen.

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
