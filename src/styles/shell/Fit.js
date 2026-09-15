import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";

/*
  The scaler and the device frame. Stays a JS template — the only chunk in
  the sheet that interpolates a value, because the 900x675 canvas contract
  comes from src/lib/canvas.js rather than being written twice. That
  indirection is what let the canvas shrink to 900x675, and the board grow
  20% on the wall, without a number in this file changing. A `.css`
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

  - A negative `inset`, instead of an inline pixel height and then instead of
    `inset: 0`. Sizing .fb-fit to window.innerHeight and pinning it at
    `top: 0` is only flush with the screen if innerHeight reports the full
    screen height; when it came back 20px short the frame stopped 20px above
    the bottom edge and `body`'s identical #d9dbe0 showed through underneath
    as a band. `inset: 0` was the answer to that — a fixed box at `inset: 0`
    is the layout viewport by definition, so no ancestor height, no viewport
    unit and no measurement can get it wrong.

    On the device it was still a few px short at the bottom. That is the
    third time this band has come back, and the first two fixes were both
    correct about their own mechanism, which is the tell: the layout viewport
    is simply not guaranteed to be the pane of glass, to the pixel, on every
    iPadOS build. Chasing exactness is what keeps failing.

    So the frame no longer tries to equal the screen — it deliberately
    overshoots it by --fit-bleed on all four sides. The canvas covers *the
    frame* (Fit.jsx measures it), `overflow: hidden` clips whatever runs past
    the glass, and body cannot show through an edge that ends 8px outside the
    screen no matter how the layout viewport is computed. It costs 8 screen
    px off each edge of the board's own outer padding — 22/24/18 canvas px,
    so 26/29/22 at 1.2x — which is blank in every view. Nothing content-
    bearing is within 8px of the canvas edge; the closest is the note FAB at
    31px. That is the whole trade: a sliver of padding nobody can see, for a
    class of bug that cannot recur.

    Deliberately symmetric rather than bottom-only. The reported sliver is at
    the bottom, but the shortfall it comes from is a property of how iPadOS
    reports the viewport, not of that edge — so bleeding only where it has
    shown up would just wait for the next build to move it.

  - Nothing here caps the canvas to one uniform scale any more. Fit.jsx
    covers both axes of this box exactly (see its header), so the canvas is
    flush to all four edges and --frame-bg below is only ever visible in an
    off-aspect dev window, where it is wanted. The canvas being smaller than
    the panel now (900x675 against 1080x810) changes nothing here: covering
    a frame is the same operation whether the scale lands above or below 1.

  The box-shadow stays: it is drawn outside the canvas, so `overflow:
  hidden` clips it away for free when the canvas is flush, while it still
  reads as a device frame in a letterboxed dev window.
*/
export default `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');

.fb-fit {
  position: fixed; inset: calc(-1 * var(--fit-bleed));
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
