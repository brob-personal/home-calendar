import { useState, useEffect, useRef } from "react";

import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";

/*
  Maps the fixed 1080x810 canvas onto the frame it lands in. Every dimension
  downstream is tuned to that canvas and nothing has a responsive breakpoint,
  so the board is scaled, never reflowed.

  The wall iPad (7th gen / A2197) is 2160x1620 native, so its standalone
  landscape viewport is 1080x810 CSS px and the canvas lands 1:1.

  Two changes here finish off the grey border that framed the board on the
  device after the previous pass (see src/styles/shell/Fit.js for the full
  history) had removed the top sliver and the corner wedges:

  1. Measure .fb-fit, not the window. The frame is `position: fixed; inset:
     0` now, so it *is* the layout viewport — but it is also the box the
     canvas actually has to cover, and measuring the thing you must cover is
     what makes covering it exact. The previous version instead set .fb-fit's
     own height from window.innerHeight; when innerHeight came back 20px
     short of the screen under viewport-fit=cover, the frame ended 20px above
     the bottom edge and body's identical grey showed through beneath it.
     getBoundingClientRect was rejected on the last pass for measuring a
     `100dvh` box against a `height: 100%` parent — two disagreeing height
     sources. With `inset: 0` there is only one source and that objection is
     gone. window.innerWidth/innerHeight stays as the fallback for when the
     rect is unmeasurable (jsdom, and the first paint before layout).

  2. Cover both axes instead of `Math.min` on one. A single uniform scale
     letterboxes the moment the frame is not exactly 4:3, and it never quite
     is — anything that shaves a row of pixels off the height drops the scale
     below 1 and opens --frame-bg down both sides. That was the left and
     right of the reported border. Near the canvas aspect each axis now gets
     its own scale and the canvas is flush on all four edges: nothing
     cropped, no gap to fill.

  Off-aspect frames (a laptop browser during development) keep the uniform
  contain-fit and the letterboxed device look — stretching the board to 16:9
  would make the dev preview lie about the real layout. FILL_TOLERANCE is
  what separates "this is the wall iPad, near enough" from "this is a desktop
  window": 15% covers the device standalone (0% off-aspect) and the same
  device in a Safari tab (~11%), and excludes every normal desktop window.

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
  Exported for Fit.test.jsx: the whole fix is in this mapping and it is worth
  asserting without a render in the way. Returns the per-axis scales; equal
  values mean a uniform letterboxed fit.
*/
export function fitFor(width, height) {
  // A zero on either axis means there is nothing trustworthy to scale
  // against yet. 1:1 is the device's own answer, so it is the safe guess.
  if (!width || !height) return { x: 1, y: 1 };
  const sx = width / CANVAS_W;
  const sy = height / CANVAS_H;
  if (Math.abs(sx / sy - 1) <= FILL_TOLERANCE) return { x: sx, y: sy };
  const s = Math.min(sx, sy);
  return { x: s, y: s };
}

function measureFrame(el) {
  const r = el?.getBoundingClientRect();
  // jsdom has no layout engine and reports 0x0; so does a real browser for
  // the instant before first layout. Fall back to the viewport it would have
  // resolved to anyway.
  if (r?.width && r?.height) return { w: r.width, h: r.height };
  if (typeof window === "undefined") return { w: 0, h: 0 };
  return { w: window.innerWidth, h: window.innerHeight };
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
      const { w, h } = measureFrame(ref.current);
      const next = fitFor(w, h);
      // Returning prev on an identical measurement keeps a resize burst from
      // re-rendering the whole board for nothing.
      setFit((prev) => (prev.x === next.x && prev.y === next.y ? prev : next));
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
        scale() before translate() is load-bearing. The transform list
        composes as scale x translate, so the -50% offsets are scaled with it
        — per axis — and the canvas lands flush on .fb-fit's top-left at a
        covering scale, and centred on its midpoint at a letterboxing one.
        Written translate-first it would only be right at scale 1.
      */}
      <div className="fb-device" style={{ transform: `${scale} translate(-50%, -50%)` }}>
        {children}
      </div>
    </div>
  );
}
