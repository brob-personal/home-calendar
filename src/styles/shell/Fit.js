import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";

/*
  The scaler and the device frame. Stays a JS template — the only chunk in
  the sheet that interpolates a value, because the 1080x810 canvas contract
  comes from src/lib/canvas.js rather than being written twice. A `.css`
  file loaded with `?raw` can't reach that constant, so this one file keeps
  the mechanism the other fourteen chunks dropped.

  Must lead the sheet: the Google Fonts @import has to precede every other
  rule in the stylesheet or the browser drops it.

  Deferred Defect #11 (R1), assigned to R5, is fixed here: `height: 100vh`
  counts browser chrome on iOS Safari outside standalone mode, so the scaled
  canvas ends up taller than the visible viewport and the footer
  view-switcher is clipped. `100dvh` excludes that chrome; the `100vh`
  declaration stays first as the fallback for browsers that don't support
  the dynamic-viewport unit.
*/
export default `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');

.fb-fit {
  width: 100%; height: 100vh; height: 100dvh; min-height: 380px;
  display: grid; place-items: center;
  background: var(--frame-bg); overflow: hidden;
}
.fb-device {
  width: ${CANVAS_W}px; height: ${CANVAS_H}px; flex: none;
  transform-origin: center center;
  box-shadow: 0 10px 40px var(--shadow-device);
  border-radius: 4px; overflow: hidden;
}
`;
