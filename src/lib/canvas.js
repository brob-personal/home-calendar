/*
  The canvas contract, and the board's one size knob.

  Every dimension in src/styles/** and src/lib/layout.js is written in canvas
  px and tuned to these two numbers. <Fit> then maps the whole canvas onto the
  device viewport with a single transform, so the board is scaled, never
  reflowed — there is not one responsive breakpoint anywhere below this file.

  The wall iPad (7th gen / A2197) is 2160x1620 native, so its standalone
  landscape viewport is 1080x810 CSS px. The canvas used to be that exact
  size, which made <Fit> resolve to 1:1 and left the board rendering at the
  iPad's raw CSS resolution — 132 CSS px per inch. Correct, flush to all four
  edges, and too small to read from across a room: 12-15px type at arm's
  length is fine on a tablet you hold, and wrong on a board on a wall.

  So the canvas is now deliberately *smaller* than the screen it ships on.
  900x675 is 1080x810 divided by 1.2 and still exactly 4:3, so <Fit> covers
  the device with a uniform 1.2x on both axes and nothing is cropped or
  stretched. Net effect on the wall: every glyph, chip, row and tap target is
  20% larger than it was, and the calendar body is the same height it always
  was in screen px (the 56px strip <Fit>'s upscale would otherwise have cost
  it came back out of --stage-gap-b, the dead band the retired footer left
  behind — see src/styles/tokens.js).

  To resize the whole board again, change these two numbers and nothing else:
  keep the 4:3 ratio (anything else letterboxes), divide 1080x810 by the
  factor you want, and re-check the two physical floors that are written in
  canvas px rather than derived — MIN_EVENT_COL_W and MORE_LANE_W in
  layout.js, which layout.test.js pins.

  Deliberately not a device-measured or user-adjustable scale: the board is
  one pinned appliance on one known panel, so this is a build-time constant,
  not a runtime setting.
*/
export const CANVAS_W = 900;
export const CANVAS_H = 675;

/*
  The panel the canvas is mapped onto, in CSS px — the wall iPad's standalone
  landscape viewport. Nothing lays out against these; they are here so the
  1.2x above is checkable rather than a bare literal, and so the tests that
  assert "the canvas covers the real device exactly" have a name to use.
*/
export const DEVICE_W = 1080;
export const DEVICE_H = 810;
