import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";

/*
  The scaler and the device frame. Stays a JS template — the only chunk in
  the sheet that interpolates a value, because the 1080x810 canvas contract
  comes from src/lib/canvas.js rather than being written twice. A `.css`
  file loaded with `?raw` can't reach that constant, so this one file keeps
  the mechanism the other fourteen chunks dropped.

  Must lead the sheet: the Google Fonts @import has to precede every other
  rule in the stylesheet or the browser drops it.

  Deferred Defect #11 (R1) was originally fixed here by swapping `height:
  100vh` for `100dvh`, to stop browser chrome making the canvas taller than
  the visible viewport in a Safari tab. That held, but it introduced a
  second fault: #root is `height: 100%` (the layout viewport) while this was
  `100dvh`, and on iPad 7th gen under viewport-fit=cover the two disagree by
  the 20pt status bar — which showed up as frame grey on all four edges of
  the board. Fit.jsx now measures window.innerHeight and sets width/height
  here inline; the full reasoning is in that file's header.

  What the declarations below are doing about it:

  - position: fixed detaches .fb-fit from #root's height, so an ancestor
    that resolves taller than the viewport can no longer leave a band of
    body grey showing underneath. The 100vh/100dvh pair stays as the
    pre-hydration fallback for the paint before Fit.jsx's inline size lands.

  - No `min-height`. Now that the height is set to a measured viewport, a
    floor could only ever push .fb-fit past the screen and reintroduce the
    overflow this is meant to remove.

  - .fb-device is absolutely positioned and centred by its own transform
    rather than by `display: grid; place-items: center` on the parent. Its
    layout box stays 1080x810 whatever the scale, so as a grid item it
    overflowed the row and got top-aligned — that was the ~10px grey sliver
    above the board. Out of flow it contributes no overflow at all and the
    letterbox is symmetric by construction.

  - No `border-radius`. At scale 1 the canvas is flush to the screen, so a
    4px radius clipped four small wedges out of the board and showed frame
    grey through them — the same class of artefact as the border this
    change removes. The box-shadow stays: it is drawn outside the canvas,
    so `overflow: hidden` clips it away for free on the device while it
    still reads as a device frame in a letterboxed dev window.
*/
export default `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');

.fb-fit {
  position: fixed; top: 0; left: 0;
  width: 100%; height: 100vh; height: 100dvh;
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
