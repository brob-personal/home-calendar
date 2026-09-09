import { useEffect, useRef } from "react";

import { drawStrokes } from "./drawStrokes.js";

/* Read-only render of a note at any size. Moved verbatim from
   family-board.jsx:1110-1118. */
export function NoteThumb({ strokes, w, h }) {
  const ref = useRef(null);
  useEffect(() => {
    drawStrokes(ref.current, strokes || [], w, h);
  }, [strokes, w, h]);
  return <canvas ref={ref} style={{ width: w, height: h, display: "block" }} />;
}
