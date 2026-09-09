import { NOTE_W } from "./geometry.js";

/*
  Moved verbatim from family-board.jsx:1090-1108.

  Strokes are stored as normalized 0-1 points, which is why the same stroke
  data renders correctly in the 430x250 window and in the 150x87 dock
  thumbnail, and why it would survive a change of canvas size. PLAN.md §5
  rule 5 names this as deliberate design to extend rather than replace.

  Two details worth not "cleaning up":

    - `dpr = 2` is hardcoded to the iPad 7th gen's 2x screen rather than read
      from devicePixelRatio. On the target device those are the same number.
    - The single-point case draws a 0.4px horizontal segment, because a
      moveTo with no lineTo strokes nothing and a tap with no drag would
      otherwise leave no dot at all.
*/
export function drawStrokes(canvas, strokes, w, h) {
  if (!canvas) return;
  const dpr = 2;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  strokes.forEach((s) => {
    if (!s.pts?.length) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.width * (w / NOTE_W));
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * w + 0.4, s.pts[0][1] * h);
    ctx.stroke();
  });
}
