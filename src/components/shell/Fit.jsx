import { useState, useEffect } from "react";

import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";

/*
  Scales the fixed 1080x810 canvas to whatever viewport it lands in. On the
  real device the scale resolves to 1; everywhere else the board is
  letterboxed rather than reflowed, which is the whole point — every
  dimension downstream is tuned to the fixed canvas and nothing has a
  responsive breakpoint.

  Why this measures the viewport in JS rather than reading back a
  CSS-sized box: the previous version sized .fb-fit with `height: 100dvh`
  and measured the result with getBoundingClientRect. That left two
  different height sources in one chain — #root's `height: 100%` (the
  layout viewport, which viewport-fit=cover grows to the full screen) and
  .fb-fit's `100dvh` — and on iPad 7th gen they disagree by the 20pt status
  bar. Every pixel of that disagreement surfaced as frame grey, on all four
  edges at once:

    - .fb-fit measured ~20px shorter than the screen, so the scale derived
      from it shrank the canvas ~2.5% more than needed, letterboxing ~13px
      down each side;
    - .fb-device's 810px layout box then overflowed .fb-fit's grid row.
      Grid top-aligns a track it cannot fit, and transform-origin: center
      put the scaled canvas half the shortfall below that, leaving a ~10px
      sliver of grey above it (and clipping the same ~10px off the bottom
      of the board);
    - and .fb-fit, being 20px shorter than #root, let body's identical grey
      show through as a 20px band underneath.

  window.innerWidth/innerHeight is the single source of truth now. It is
  the same quantity 100dvh is meant to express, it is measured rather than
  inferred from how a given iOS build resolves a viewport unit under
  viewport-fit=cover, and .fb-fit is sized to it explicitly so no
  ancestor's height can leave a gap behind it.

  Deliberately not window.visualViewport: iOS shrinks that when the
  on-screen keyboard opens, which would rescale the entire board every time
  Composer, Settings or a note took focus. innerHeight tracks browser
  chrome (so Deferred Defect #11 stays fixed — the canvas is never taller
  than the visible viewport in a Safari tab) but ignores the keyboard.

  The resize/orientationchange listeners replace the old ResizeObserver,
  which could only react to .fb-fit's own box changing and so went stale
  whenever the viewport moved without resizing that element.

  jsdom reports 1024x768 for innerWidth/innerHeight. That is also 4:3, so
  under test the canvas fits exactly with no letterbox on either axis.
*/
const readViewport = () => {
  if (typeof window === "undefined") return null;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // A zero on either axis means there is nothing trustworthy to scale
  // against yet; leaving state null keeps .fb-fit on its CSS fallback
  // rather than collapsing it to 0x0.
  return w && h ? { w, h } : null;
};

export function Fit({ children }) {
  // Seeded from the initializer, not an effect, so the first paint is
  // already at the right scale instead of flashing through scale 1.
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const measure = () => {
      const next = readViewport();
      if (!next) return;
      // Returning prev on an identical measurement keeps a resize burst
      // from re-rendering the whole board for nothing.
      setViewport((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  const scale = viewport ? Math.min(viewport.w / CANVAS_W, viewport.h / CANVAS_H) : 1;

  return (
    <div
      className="fb-fit"
      style={viewport ? { width: `${viewport.w}px`, height: `${viewport.h}px` } : undefined}
    >
      {/*
        scale() before translate() is load-bearing. The transform list
        composes as scale x translate, so the -50% offsets are scaled too
        and the canvas stays centred on .fb-fit's midpoint at every scale.
        Written translate-first it would only centre correctly at scale 1.
      */}
      <div className="fb-device" style={{ transform: `scale(${scale}) translate(-50%, -50%)` }}>
        {children}
      </div>
    </div>
  );
}
