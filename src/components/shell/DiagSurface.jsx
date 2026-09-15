import { useEffect, useRef, useState } from "react";

import { BUILD_STAMP } from "../../lib/build.js";
import { FitDiag, isColourProbeOn, setColourProbe } from "./FitDiag.jsx";

/*
  The two things about the board that have to be reachable and visible on the
  wall: which build is running, and the diagnostic overlay.

  Both constraints come from the device, not from taste. docs/DEVICE-SETUP.md
  puts the board on the wall as a standalone home-screen PWA inside Guided
  Access, which means:

    - There is no address bar, so `?diag` is not merely inconvenient, it is
      untypeable. The previous version of this diagnostic shipped behind a query
      parameter and was therefore unreachable in the one place it was needed.
    - Guided Access disables the home button and every system gesture, so the
      only input the board can receive is a tap inside its own frame. A gesture
      is the only trigger available, and it must toggle — there is no back
      button and no way to reload out of a stuck overlay short of the
      four-step exit dance in §4.
    - Picking up a deploy is that same four-step dance. Six fixes for the grey
      band shipped inside 84 minutes; nothing recorded which of them the device
      was actually running when each was judged. So the SHA is on screen
      permanently, not behind the gesture: a photograph of the wall has to
      carry its own build identity or it is not evidence about a build.

  Deliberately not a hidden long-press on an existing control. Every control on
  the board does something, and a gesture layered on top of one that does
  something else is how a diagnostic gets triggered by accident on a kitchen
  wall — or worse, fires the control three times on the way to opening the
  overlay.
*/

/*
  The trigger region, in the top-left corner of the glass.

  Top-left is the only corner free of everything that matters here. The bottom
  edge is the artefact under investigation and must never be covered; the
  bottom-right holds the note FAB; the ends of the status bar hold the clock and
  the radio indicators. What is under the top-left 56px is .fb-board's own
  padding and the first glyph or so of the day-of-week text.

  Counted from a capture-phase listener on the window with a coordinate test,
  rather than from a transparent <div> sitting in that corner. A div would have
  been simpler and is what this started as, but it swallows every tap in the
  region — and two full-canvas overlays reach into that corner and treat any
  tap as meaningful: the screensaver wakes on one, and SleepVeil counts them.
  A 56px dead spot in the corner of a sleeping board is a behaviour change, and
  this change is not allowed to make one. Watching the events instead costs
  nothing and blocks nothing: the taps still reach whatever is under them, and
  the only things under them either do nothing or do the thing they should.
*/
const TRIGGER_PX = 56;

const inCorner = (e) =>
  typeof e.clientX === "number" &&
  e.clientX >= 0 &&
  e.clientY >= 0 &&
  e.clientX < TRIGGER_PX &&
  e.clientY < TRIGGER_PX;

/*
  Tap counting.

  The count is resolved after the taps stop, not as they arrive. Acting on the
  third tap immediately would make a four-tap indistinguishable from a
  three-tap followed by a stray one — the overlay would open on the way to the
  colour probe, and the probe would then have to close it. Waiting out a quiet
  window makes the two gestures disjoint, at the cost of the overlay appearing
  a third of a second after the last tap.

  450ms is long enough for a deliberate triple-tap by someone on a step ladder
  and short enough not to feel broken.
*/
const TAP_WINDOW_MS = 450;
const TAPS_DIAG = 3;
const TAPS_PROBE = 4;

export function DiagSurface() {
  const [open, setOpen] = useState(false);
  // Mirrors the probe for the badge's benefit only. The DOM holds the real
  // state — see setColourProbe — so the Settings entry point and this one
  // cannot disagree about whether it is on.
  const [probe, setProbe] = useState(false);
  const taps = useRef(0);
  const timer = useRef(null);

  // Held in a ref so the window listener below can be registered once, with no
  // dependency on state that changes when the overlay opens. Re-registering a
  // pointer listener mid-gesture is how a tap gets counted twice or lost.
  const onTapRef = useRef(null);

  useEffect(() => {
    // The probe survives the sheet that turned it on, and deliberately
    // outlives a re-mount too, so pick up whatever is already there.
    setProbe(isColourProbeOn());

    /*
      pointerdown rather than click: it fires once per tap with no 300ms
      settle and no synthesized double-tap handling in between, which is what
      makes counting four of them reliable.

      Capture phase, and passive, so this cannot alter the event's journey. It
      observes and never calls preventDefault or stopPropagation — the tap
      goes on to reach whatever is beneath it exactly as it did before.
    */
    const onPointerDown = (e) => {
      if (inCorner(e)) onTapRef.current?.();
    };
    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      clearTimeout(timer.current);
    };
  }, []);

  const toggleProbe = () => {
    const next = !isColourProbeOn();
    setColourProbe(next);
    setProbe(next);
    // The overlay is opaque and full-screen. Leaving it up over the probe
    // would hide the one edge the probe exists to photograph.
    if (next) setOpen(false);
  };

  /*
    The count is resolved after the taps stop; see TAP_WINDOW_MS. Because the
    listener is on the window rather than on an element, the same corner
    toggles the overlay back off while the overlay is covering that corner —
    which matters, because Guided Access allows taps inside the app and nothing
    else, so an overlay with no gesture out of it would be a trap.

    Published to the ref from an effect with no dependency array, so it is
    refreshed after every render but never written during one. Mutating a ref
    while rendering is the kind of thing that works until it doesn't.
  */
  useEffect(() => {
    onTapRef.current = () => {
      taps.current += 1;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const count = taps.current;
        taps.current = 0;
        if (count === TAPS_DIAG) setOpen((wasOpen) => !wasOpen);
        else if (count === TAPS_PROBE) toggleProbe();
      }, TAP_WINDOW_MS);
    };
  });

  return (
    <>
      {/*
        The build badge, and a second job it does for free.

        It is `position: fixed; bottom: 0`, so its lower edge is the bottom edge
        of the layout viewport, marked in lime. That makes the badge a passive
        test for mechanism B in every photograph, with no gesture required: if
        there is grey *below* the lime line, the page's viewport ends above the
        glass and the page never received those pixels. If the grey starts at
        the lime line, the page has the pixels and is painting them.

        pointer-events: none — it sits over the bottom-left of the board and
        must not become a dead spot on a board where every control is meant to
        be tappable.
      */}
      <div
        // A stable handle rather than a class, so the badge is findable in the
        // inspector and in a test without adding a name to the board's
        // stylesheet, which this change does not touch.
        data-fb-build=""
        style={{
          position: "fixed",
          left: 0,
          bottom: 0,
          zIndex: 2147483646,
          padding: "2px 5px",
          background: "rgba(0,0,0,.55)",
          color: "#fff",
          font: "600 9px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace",
          letterSpacing: ".02em",
          boxShadow: "inset 0 -2px 0 #0f0",
          pointerEvents: "none",
        }}
      >
        {/*
          The gesture is spelled out rather than abbreviated. It costs about
          90px of a 1080px edge, and it is the difference between a board
          someone can diagnose in a year's time and a board with an
          undiscoverable secret in the corner.
        */}
        {BUILD_STAMP}
        {probe ? "  PROBE" : ""} · 3 taps top-left
      </div>

      {open && <FitDiag onClose={() => setOpen(false)} onProbe={toggleProbe} />}
    </>
  );
}
