import { useState, useEffect, useRef } from "react";

import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";

/*
  Scales the fixed 1080x810 canvas to whatever viewport it lands in.

  Moved verbatim from family-board.jsx:396-419. On the real device the scale
  resolves to 1; everywhere else the board is letterboxed rather than
  reflowed, which is the whole point — every dimension downstream is tuned to
  the fixed canvas and nothing has a responsive breakpoint.

  jsdom has no ResizeObserver and reports 0x0 for getBoundingClientRect, so
  src/test/setup.js stubs the observer with one that never fires. The `if
  (r.width && r.height)` guard is what keeps that from computing scale 0.
*/
export function Fit({ children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setScale(Math.min(r.width / CANVAS_W, r.height / CANVAS_H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="fb-fit" ref={ref}>
      <div className="fb-device" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
