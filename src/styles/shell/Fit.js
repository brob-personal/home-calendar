import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";

/*
  The scaler and the device frame. Stays a JS template — the only chunk in
  the sheet that interpolates a value, because the 1080x810 canvas contract
  comes from src/lib/canvas.js rather than being written twice. A `.css`
  file loaded with `?raw` can't reach that constant, so this one file keeps
  the mechanism the other fourteen chunks dropped.

  Must lead the sheet: the Google Fonts @import has to precede every other
  rule in the stylesheet or the browser drops it.

  History of the grey border this file keeps fighting. Deferred Defect #11
  (R1) was first fixed by swapping `height: 100vh` for `100dvh`, to stop
  browser chrome making the canvas taller than the visible viewport in a
  Safari tab. That introduced a second fault — #root at `height: 100%` (the
  layout viewport) disagreeing with `100dvh` by iPad 7th gen's 20pt status
  bar — so the pass after that removed `display: grid` centring (a ~10px
  grey sliver above the board, from .fb-device's 1080x810 layout box
  overflowing a grid row that top-aligns) and the 4px `border-radius` (four
  wedges of frame grey clipped out of the corners), and moved the size onto
  an inline width/height measured from window.innerWidth/innerHeight.

  Grey still framed the board on the device, on the left, right and bottom.
  Two causes were left, and the declarations below are what removes them:

  - `inset: 0` instead of an inline pixel height. Sizing .fb-fit to
    window.innerHeight and pinning it at `top: 0` is only flush with the
    screen if innerHeight reports the full screen height. When it comes back
    20px short — which is exactly what viewport-fit=cover and the status bar
    do on this device — the frame stops 20px above the bottom edge and
    `body`'s identical #d9dbe0 shows through underneath as a band. A fixed
    box with `inset: 0` is the layout viewport by definition: no ancestor
    height in the chain, no viewport unit to resolve, no measurement to get
    wrong, and nothing left for body to show behind.

  - Nothing here caps the canvas to one uniform scale any more. Fit.jsx
    covers both axes of this box exactly (see its header), so the canvas is
    flush to all four edges and --frame-bg below is only ever visible in an
    off-aspect dev window, where it is wanted.

  The box-shadow stays: it is drawn outside the canvas, so `overflow:
  hidden` clips it away for free when the canvas is flush, while it still
  reads as a device frame in a letterboxed dev window.
*/
export default `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');

.fb-fit {
  position: fixed; inset: 0;
  background: var(--frame-bg); overflow: hidden;
}
.fb-device {
  position: absolute; left: 50%; top: 50%;
  width: ${CANVAS_W}px; height: ${CANVAS_H}px;
  transform-origin: 0 0;
  box-shadow: 0 10px 40px var(--shadow-device);
  overflow: hidden;
}
`;
