/*
  The canvas contract. Every size in src/styles/** is tuned to these two
  numbers: 1080 x 810 CSS px (2160 x 1620 @2x), landscape, iPad 7th gen
  (A2197). <Fit> scales this canvas to whatever viewport it lands in; on the
  real device the scale resolves to 1.

  Moved verbatim from family-board.jsx:17-18.
*/
export const CANVAS_W = 1080;
export const CANVAS_H = 810;
