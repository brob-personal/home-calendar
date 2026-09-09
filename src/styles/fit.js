import { CANVAS_W, CANVAS_H } from "../lib/canvas.js";

/*
  The scaler and the device frame. First chunk in the sheet, and the only one
  that interpolates JS — the 1080 x 810 canvas contract comes from
  src/lib/canvas.js rather than being written twice.

  Deferred Defect #11 (R1) is here, unfixed and assigned to R5: `height: 100vh`
  counts browser chrome on iOS Safari outside standalone mode, so the scaled
  canvas ends up taller than the visible viewport and the footer view-switcher
  is clipped. Correct in Guided Access and a home-screen install, broken in
  plain Safari. The fix is `100dvh` with a `100vh` fallback.

  The Google Fonts @import leads the sheet because @import must precede every
  rule in a stylesheet. It is also Deferred Defect #10, assigned to R14: a
  cold board with no network loses its typeface.
*/
export default `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');

.fb-fit {
  width: 100%; height: 100vh; min-height: 380px;
  display: grid; place-items: center;
  background: #D9DBE0; overflow: hidden;
}
.fb-device {
  width: ${CANVAS_W}px; height: ${CANVAS_H}px; flex: none;
  transform-origin: center center;
  box-shadow: 0 10px 40px rgba(20,24,32,.18);
  border-radius: 4px; overflow: hidden;
}
`;
