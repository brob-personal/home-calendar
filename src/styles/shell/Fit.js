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

  - The frame extends past the bottom of the layout viewport, and is flush
    with it on the other three sides. This is the fourth attempt at the grey
    band along the bottom of the board, and the first three all failed the
    same way, so the reasoning matters more than the declaration:

      1. `100vh` -> `100dvh`, to stop browser chrome making the canvas taller
         than the visible viewport. Held, but left #root's `height: 100%`
         disagreeing with `100dvh` by the status bar.
      2. An inline pixel height measured from window.innerHeight. When
         innerHeight came back 20px short of the screen, the frame ended 20px
         above the bottom edge and body's identical #d9dbe0 filled the gap.
      3. `inset: 0` — a fixed box at `inset: 0` is the layout viewport by
         definition, so nothing can measure it wrong. Correct, and the band
         survived, because the layout viewport is itself short of the glass.
      4. `inset: -8px`, overshooting equally on all four sides. The band
         survived that too, and *how* it survived is the diagnosis: it is at
         the bottom and nowhere else. A frame centred in the screen cannot
         produce a one-sided gap — the canvas is centred in the frame, so any
         shortfall would split evenly top and bottom. A gap at the bottom
         only means the frame is anchored at the top and runs out early,
         which is exactly what viewport-fit=cover and the 20pt status bar do
         on this device. The symmetric bleed spent 8px on three edges that
         were already flush and put 8 where about 20 were needed.

    So the overshoot goes where the evidence puts it. top/left/width are
    flush, and the height is the layout viewport plus --fit-extend-b. The
    canvas covers the frame (Fit.jsx measures it), `overflow: hidden` clips
    what runs past the glass, and there is no bottom edge left for body to
    show at.

  - `max(100%, 100vh)` rather than `100%`, because pass 5 was still short and
    the two are not the same quantity. `100%` on a fixed box resolves against
    the initial containing block, which is the *layout* viewport — the thing
    that has come up short at every step of this. `100vh` resolves against the
    large viewport, the screen with all dynamic browser UI retracted, which
    under viewport-fit=cover is the full pane of glass including the strip
    behind the status bar. Either one can be the smaller on a given iPadOS
    build, and nothing in the platform promises which. Taking the larger of
    the two costs nothing anywhere — in a desktop window they are the same
    number — and it stops the frame's height from depending on which of the
    two a particular iPad decides to short.

    `max()` and `vh` are both old enough to be safe here; deliberately not
    `dvh`/`lvh`/`svh`, which would be the precise way to say this but would
    invalidate the whole declaration (and leave the frame at `height: auto`)
    on anything that does not know them.

    The cost is at the bottom only, and it is bounded: whatever part of
    --fit-extend-b is not absorbed by the shortfall is clipped off the bottom
    of the board. The first 22 screen px are free — that is --board-pad-b (18
    canvas px at 1.2x), which is blank in every view. 40px means up to 18
    screen px, 15 canvas px, can come off the bottom of the calendar itself if
    the frame turns out not to have been short at all. That is the deliberate
    direction to err in at this point: too much extension costs a strip of
    padding, too little leaves grey, and grey is the thing being reported.

    So this is two independent guards, not one: the frame no longer takes the
    layout viewport's word for the screen height, *and* it overshoots whatever
    it does resolve to.

  The box-shadow stays: it is drawn outside the canvas, so `overflow:
  hidden` clips it away for free when the canvas is flush, while it still
  reads as a device frame in a letterboxed dev window.
*/
export default `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');

.fb-fit {
  position: fixed; top: 0; left: 0;
  width: 100%; height: calc(max(100%, 100vh) + var(--fit-extend-b));
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
