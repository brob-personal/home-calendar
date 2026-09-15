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

  History of the grey band along the bottom of the board, which took six
  passes and one wrong idea shared by all of them. Each tried to make the
  frame equal the screen, and then to overshoot it, on the assumption that the
  screen height was something to be discovered:

    1. `100vh` -> `100dvh`, so browser chrome could not make the canvas taller
       than the visible viewport. Held, but left #root's `height: 100%`
       disagreeing with `100dvh` by iPad 7th gen's 20pt status bar. That pass
       also removed `display: grid` centring (a ~10px sliver above the board,
       from .fb-device's layout box overflowing a grid row that top-aligns)
       and the 4px `border-radius` (four wedges of frame grey clipped out of
       the corners). Both of those stayed fixed.
    2. An inline pixel height measured from window.innerHeight.
    3. `inset: 0` — a fixed box at `inset: 0` is the layout viewport by
       definition, so no measurement can get it wrong.
    4. `inset: -8px`, overshooting equally on all four sides.
    5. `calc(100% + 24px)`, overshooting downward only, once the band turning
       out to be one-sided showed the frame was top-anchored and short.
    6. `calc(max(100%, 100vh) + 40px)`, on the grounds that `100%` and
       `100vh` are different quantities and either can be the short one.

  Six closed the band and produced the opposite symptom in the same stroke:
  the canvas is scaled to cover the frame, so a frame 40px taller than the
  glass scales the board 40px past the glass, and the bottom of the calendar
  and the note FAB fell off the screen. That is the point at which the shared
  assumption is visibly wrong. Covering the glass and not overshooting it are
  the same problem, not two to be traded off, and no extension value settles
  it while the vertical scale is derived from a measurement.

  So the frame is out of that job entirely. Fit.jsx pins the canvas to
  DEVICE_H — 810 CSS px, which the panel's 2160x1620 at 2x makes a known
  quantity, not a measured one — and anchors it to the top of the frame. The
  board's bottom edge then lands on the bottom of the glass by construction.

  What the declarations below are doing about it:

  - `inset: 0`, with no extension. The frame is back to the plain viewport
    because nothing reads its height for scale any more. It only has to be
    somewhere to put the background.

  - No `overflow: hidden`. This is the one line that still mattered: with the
    canvas pinned to 810 and the frame resolving to whatever the layout
    viewport reports, a short frame would have clipped the bottom of the
    canvas and put the band straight back — the frame cutting off the very
    board that was covering the glass. .fb-device carries its own
    `overflow: hidden`, so the board's content is still clipped to the canvas
    box, which is the clip that was ever wanted. html and body are
    `overflow: hidden` in index.html, so nothing here can scroll.

  - No `min-height`, and no `--fit-extend-b`. Both were floors under a
    measured height, and there is no longer a measured height to put a floor
    under.

  - .fb-device is absolutely positioned and offset by its own transform
    rather than by `display: grid; place-items: center` on the parent. Its
    layout box stays CANVAS_W x CANVAS_H whatever the scale, so as a grid item
    it overflowed the row and got top-aligned — that was the ~10px grey sliver
    above the board. Out of flow it contributes no overflow at all. `top` is
    set inline by Fit.jsx, because it is the anchor and the anchor is the
    thing that decides which edge a discrepancy lands on.

  - No `border-radius`. Flush to the screen a 4px radius clipped four small
    wedges out of the board and showed frame grey through them — the same
    class of artefact as the border this whole sequence removes.

  - No box-shadow on .fb-device. It was there to read as a device frame in a
    letterboxed dev window, and the argument for keeping it was that
    `overflow: hidden` on .fb-fit clipped it away everywhere else. Pass 7 took
    that clip off — it had to, or a short frame would have clipped the canvas
    covering the glass — and the shadow has been painting into the gap along
    the bottom ever since. `0 10px 40px rgba(20,24,32,.18)` over --frame-bg's
    #D9DBE0 computes to #B2B4B8 at full strength and fades back to #D9DBE0
    across the blur, which is exactly the light blue-grey the band was
    measured at off a photo of the wall, and not the flat #D9DBE0 it read as
    before. The shadow was never load-bearing and it is actively making the
    remaining gap darker and easier to see than the grey it sits on, so it
    goes. --shadow-device stays in tokens.js; nothing else reads it, but it is
    the colour to restore if a dev-window frame is ever wanted back.

  - `env(safe-area-inset-bottom)` added to the height. Every signal Fit.jsx
    can read in JS describes the viewport, and the insets are the one quantity
    that describes the difference between the viewport and the glass. On this
    panel it measured 0 — a home button, no indicator — so this declaration is
    identical to `inset: 0` and costs nothing. The inset that is *not* 0 on
    this device is the top one, 20px, and it is the whole of the discrepancy;
    #58's glassAgrees is what reads it, in JS, and Fit.jsx now writes the
    resulting height onto .fb-fit inline. That inline height wins over the
    `calc` below whenever the board is mounted, which is the point of it: a
    `100%` on a `position: fixed` box resolves against the initial containing
    block, and on this panel the initial containing block is the 790-tall
    layout viewport rather than the 810-tall glass. The declaration stays as
    the pre-mount and no-JS fallback.

  - `html, body { background: var(--paper); }`, which is the backstop and is
    deliberately the board's paper rather than the frame grey.

    `body` is in the selector and is the one place this pass goes past its
    brief, for a reason worth stating: with the page's boxes now sized to the
    glass rather than to the layout viewport, `body` reaches the bottom of the
    screen too, and index.html still paints it #D9DBE0. A backstop underneath
    an opaque grey box the same size is not a backstop. Both layers move
    together or neither does.

    This does not touch .fb-fit, which keeps --frame-bg. Inside the frame the
    grey is still correct — it is the letterboxed dev window's device border,
    and #56 settled that the gap must not be tinted. What changes is only what
    is painted *outside* the frame, which on the wall is the region this whole
    sequence has been about.

    The root element's background propagates to the canvas, and the canvas is
    the one surface that covers the whole web view regardless of what any box
    in the document resolves to — it is painted outside the viewport's clip,
    which is precisely why the band was visible at all while every laid-out
    layer stopped at 790. Under #59's colour probe that region photographed as
    the page's own background rather than as neutral grey, which is what ruled
    out iPadOS drawing over the bottom of the web view and made this a page
    problem after all.

    So if the two changes above are complete this rule is invisible: the board
    covers the glass and nothing sees the canvas. If any sub-pixel of the old
    gap survives them, it is now the difference between a grey line under the
    board and no line at all, because --paper is what .fb-root paints its own
    bottom edge with.

    var(--paper) rather than a hex literal, so there is still no colour written
    twice in this repository. It resolves against tokens.js's :root default
    rather than the live theme — App.jsx sets the per-theme palette inline on
    .fb-root, which html is not inside — so a non-default theme leaves this a
    near-match rather than an exact one. That is the correct trade for a layer
    that is only ever seen if something else has already failed: a backstop
    that had to be kept in sync with the theme would be a second thing to get
    wrong.
*/
export default `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');

/* The canvas backstop — see the note above. Kept first in the chunk, after
   the @import, so the frame rule below stays the chunk's first fb- selector
   and styles.smoke.test.js's slice assertions still bound it. */
html, body { background: var(--paper); }

.fb-fit {
  position: fixed; top: 0; left: 0;
  width: 100%; height: calc(100% + env(safe-area-inset-bottom, 0px));
  background: var(--frame-bg);
}
.fb-device {
  position: absolute; left: 50%;
  width: ${CANVAS_W}px; height: ${CANVAS_H}px;
  transform-origin: 0 0;
  overflow: hidden;
}
`;
