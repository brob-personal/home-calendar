import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { Fit, fitFor, glassAgrees, frameHeight } from "./Fit.jsx";
import { CANVAS_W, CANVAS_H, DEVICE_W, DEVICE_H } from "../../lib/canvas.js";

/*
  Regression cover for the grey band along the bottom of the board on iPad 7th
  gen, and for the derivation that finally explains it.

  Nine passes. The first eight each tuned a number inside an assumed
  mechanism, and what these tests asserted for all eight of them was "the
  canvas covers the frame exactly on both axes" — a property that stayed green
  the entire time the band was on screen. It had to: both sides of that
  comparison came from the same measurement, so a frame short of the glass
  satisfies it just as neatly as a frame that is not. An internally consistent
  invariant cannot catch a systematically wrong input.

  The instrumented build (c5ad5f3) found the wrong input. On the device,
  standalone and landscape:

    window.innerHeight   790      screen.availHeight   810
    doc.clientHeight     790      safe-area-inset-top   20
    visualViewport       790
    .fb-fit rect         790

  Every viewport API agrees on 790 and they are all wrong by exactly the top
  inset: iPadOS paints the standalone web view full-bleed from the top of the
  glass while reporting a layout viewport 20pt short. 790 + 20 = 810, and the
  only two signals that witness 810 are not viewport APIs at all.

  So the height is now derived rather than reduced, and these tests split in
  two accordingly:

    - glassAgrees / frameHeight: does the code take availHeight, and does it
      take it *only* when the insets corroborate the gap? This is the half
      that is actually new, and the agreement test is the thing under test —
      not the 810 that comes out of it. A derivation that fires on the wrong
      device is a ninth guess with extra steps.

    - fitFor: given a frame height, is the scale exactly that height over the
      canvas, with nothing clamping it? The previous pass floored this at
      DEVICE_H / CANVAS_H to force the scale past a measurement it did not
      trust. The floor is gone, and several assertions below invert because of
      it — that is the intended change, and the reason is that a floor
      silently absorbs the next short measurement instead of showing it.

  jsdom has no layout engine, so getBoundingClientRect is 0x0, env() resolves
  to nothing and screen.availHeight is 0. The default in here is therefore the
  *fallback* path — no glass corroboration, scale to the viewport — which is
  what setViewport drives. withGlass() below emulates the two witnesses when a
  test needs the device's actual signature.
*/

// jsdom's innerWidth/innerHeight are plain writable window properties.
function setViewport(w, h) {
  window.innerWidth = w;
  window.innerHeight = h;
}

/*
  The device's two witnesses, faked at the only two places the code reads them.

  screen.availHeight is a prototype getter in jsdom, so it needs
  defineProperty; navigator.standalone does not exist there at all, so it needs
  defining rather than overwriting.

  The insets are the interesting one. safeAreaInsets() measures env() by
  setting it as a throwaway element's height and asking the layout engine what
  that resolved to — the right way to read an inset, and completely inert in
  jsdom, which has no layout engine and drops the `env()` assignment as an
  unparseable height in the first place.

  Rather than mock the module — which would take the real probe out of the test,
  and the probe is half of what is being asserted — this patches
  getBoundingClientRect to answer for exactly that element. The probe tags
  itself with `data-fb-inset` naming the side it is currently measuring, which
  is the only thing about it that survives jsdom's parser, so that is what the
  fixture keys off. Every other rect in the page falls through to jsdom's own
  zero.
*/
const ZERO_RECT = { x: 0, y: 0, top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 };

function withGlass({ availHeight, insets = {}, standalone = true }) {
  const origRect = Element.prototype.getBoundingClientRect;
  const hadStandalone = "standalone" in window.navigator;
  const origStandalone = window.navigator.standalone;

  Object.defineProperty(window.screen, "availHeight", {
    value: availHeight,
    configurable: true,
  });
  Object.defineProperty(window.navigator, "standalone", {
    value: standalone,
    configurable: true,
  });
  Element.prototype.getBoundingClientRect = function patched() {
    const side = this.dataset?.fbInset;
    if (side) return { ...ZERO_RECT, height: insets[side] ?? 0 };
    return origRect.call(this);
  };

  return () => {
    Element.prototype.getBoundingClientRect = origRect;
    Object.defineProperty(window.screen, "availHeight", { value: 0, configurable: true });
    if (hadStandalone) {
      Object.defineProperty(window.navigator, "standalone", {
        value: origStandalone,
        configurable: true,
      });
    } else {
      delete window.navigator.standalone;
    }
  };
}

const renderFit = () => {
  const { container } = render(
    <Fit>
      <div className="fb-root" />
    </Fit>,
  );
  return {
    fit: container.querySelector(".fb-fit"),
    device: container.querySelector(".fb-device"),
  };
};

// scale(s) and scale(sx, sy) both land here, as [sx, sy].
const scalesOf = (device) => {
  const args = device.style.transform.match(/scale\(([^)]+)\)/)[1].split(",");
  const x = Number(args[0]);
  return [x, args.length > 1 ? Number(args[1]) : x];
};

afterEach(() => setViewport(1024, 768));

/*
  The wall iPad's exact reported signature, standalone and landscape. Named
  once because most of the assertions below are about what happens when one
  field of it is different, and the point of each of those is the single
  difference.
*/
const DEVICE_SIGNATURE = { standalone: true, innerH: 790, availH: 810, insetSum: 20 };

describe("glassAgrees", () => {
  it("accepts this panel's exact signature", () => {
    // The one case that must be true, and the arithmetic that makes it true:
    // the gap between the two witnesses is the inset sum, to the pixel.
    expect(glassAgrees(DEVICE_SIGNATURE)).toBe(true);
    expect(DEVICE_SIGNATURE.availH - DEVICE_SIGNATURE.innerH).toBe(DEVICE_SIGNATURE.insetSum);
  });

  it("refuses a viewport with no insets to explain the gap", () => {
    // A plain Safari tab: shorter than the screen because the browser chrome
    // really is there, and env() reports 0 because none of it is a safe area.
    // Treating that gap as glass would scale the board under the chrome, which
    // is the overshoot failure the earlier passes produced.
    expect(glassAgrees({ ...DEVICE_SIGNATURE, insetSum: 0 })).toBe(false);
    expect(glassAgrees({ standalone: true, innerH: 730, availH: 810, insetSum: 0 })).toBe(false);
  });

  it("refuses a viewport that is not shorter than the glass", () => {
    // If iPadOS ever reports the layout viewport honestly, this is the branch
    // that keeps the fix from becoming a bug: nothing to correct, so nothing
    // is corrected, and behaviour is identical to the pass before this one.
    expect(glassAgrees({ ...DEVICE_SIGNATURE, innerH: 810 })).toBe(false);
    expect(glassAgrees({ ...DEVICE_SIGNATURE, innerH: 830 })).toBe(false);
  });

  it("refuses a gap the insets cannot account for", () => {
    // The load-bearing half. A gap larger than the insets means the premise
    // underneath the derivation does not hold on this device, whatever else is
    // true — so the code declines to act on availHeight rather than adopting a
    // number it cannot explain.
    //   gap 110 -> nothing like the insets, refused
    //   gap  22 -> one px past the slack, refused
    //   gap  21 -> the slack boundary, accepted
    //   gap  20 -> the insets exactly, accepted
    expect(glassAgrees({ standalone: true, innerH: 700, availH: 810, insetSum: 20 })).toBe(false);
    expect(glassAgrees({ standalone: true, innerH: 788, availH: 810, insetSum: 20 })).toBe(false);
    expect(glassAgrees({ standalone: true, innerH: 789, availH: 810, insetSum: 20 })).toBe(true);
    expect(glassAgrees({ standalone: true, innerH: 790, availH: 810, insetSum: 20 })).toBe(true);
  });

  it("refuses anything that is not a home-screen app", () => {
    expect(glassAgrees({ ...DEVICE_SIGNATURE, standalone: false })).toBe(false);
    expect(glassAgrees({ ...DEVICE_SIGNATURE, standalone: undefined })).toBe(false);
  });

  it("refuses a witness that is missing rather than treating it as zero", () => {
    // screen.availHeight is absent in older engines and 0 in jsdom, and an
    // absent witness is not evidence of anything. NaN from an unresolvable
    // inset is the same case.
    expect(glassAgrees({ ...DEVICE_SIGNATURE, availH: undefined })).toBe(false);
    expect(glassAgrees({ ...DEVICE_SIGNATURE, availH: 0 })).toBe(false);
    expect(glassAgrees({ ...DEVICE_SIGNATURE, insetSum: NaN })).toBe(false);
  });

  it("allows float slack on the inset sum but nothing an inset could hide in", () => {
    // The +1 is for a resolved 19.999 against a reported 20, not for tuning.
    expect(glassAgrees({ standalone: true, innerH: 790, availH: 810, insetSum: 19.5 })).toBe(true);
    expect(glassAgrees({ standalone: true, innerH: 790, availH: 810, insetSum: 18.5 })).toBe(false);
  });
});

describe("frameHeight", () => {
  it("returns the glass on this panel and the viewport everywhere else", () => {
    // Always one of the two measurements, never a blend and never a constant.
    expect(frameHeight(DEVICE_SIGNATURE)).toBe(810);
    expect(frameHeight({ ...DEVICE_SIGNATURE, standalone: false })).toBe(790);
    expect(frameHeight({ ...DEVICE_SIGNATURE, insetSum: 0 })).toBe(790);
    expect(frameHeight({ standalone: true, innerH: 810, availH: 810, insetSum: 20 })).toBe(810);
  });

  it("puts the canvas on a 1.2x scale from the device's own numbers", () => {
    // The whole fix, end to end and with no literal in the middle of it: the
    // reported innerHeight and availHeight go in, and the scale that makes a
    // 675px canvas exactly fill the glass comes out. 1.2 is asserted as
    // DEVICE_H / CANVAS_H rather than typed, so this cannot pass by coincidence
    // if the canvas contract changes.
    const h = frameHeight(DEVICE_SIGNATURE);
    const fit = fitFor(1080, h);

    expect(h).toBe(DEVICE_H);
    expect(fit.y).toBe(DEVICE_H / CANVAS_H);
    expect(fit.y * CANVAS_H).toBe(DEVICE_H);
    expect(fit.x).toBe(fit.y);
    expect(fit.anchor).toBe("top");
  });
});

describe("fitFor", () => {
  it("maps the canvas onto the real panel at a uniform 1.2x", () => {
    const fit = fitFor(DEVICE_W, DEVICE_H);

    // Uniform: the canvas and the panel are both 4:3, so neither axis is
    // stretched relative to the other. Equality, not closeTo — 900x675 into
    // 1080x810 is exact, and a drift into floats would mean one of the four
    // numbers had stopped being a clean 1.2 multiple.
    expect(fit.x).toBe(fit.y);
    expect(fit.x).toBe(1.2);
    expect(CANVAS_W * fit.x).toBe(DEVICE_W);
    expect(CANVAS_H * fit.y).toBe(DEVICE_H);
  });

  it("scales 1:1 on a frame the size of the canvas, with nothing under it", () => {
    // The previous pass returned 1.2 here, because DEVICE_H was a floor under
    // every device-shaped frame regardless of what was measured. A frame this
    // size is 900x675 and the honest answer is 1:1.
    const fit = fitFor(CANVAS_W, CANVAS_H);
    expect(fit.x).toBe(1);
    expect(fit.y).toBe(1);
    expect(fit.anchor).toBe("top");
  });

  it("scales to exactly the height it is handed, with no clamp either way", () => {
    // The inverse of what this asserted for three passes, and the point of
    // removing the floor. 790 is the number the device reports and 810 is the
    // number it means; deciding between them is glassAgrees' job, upstream of
    // here. This function's job is to not quietly edit whichever one arrives —
    // so a scale that comes out wrong stays visibly wrong instead of being
    // rounded up to the answer the code was hoping for.
    for (const h of [675, 730, 750, 770, 790, 810, 834, 900]) {
      expect(fitFor(DEVICE_W, h).y * CANVAS_H).toBeCloseTo(h, 6);
    }
    expect(fitFor(1080, 790).y * CANVAS_H).not.toBe(DEVICE_H);
    expect(fitFor(1080, 810).y * CANVAS_H).toBe(DEVICE_H);
  });

  it("anchors every device-shaped frame to the top", () => {
    // Which edge a shortfall lands on. The web view is full-bleed from the top
    // of the glass, so the canvas starts there and any residue goes off the
    // bottom rather than being split across both edges.
    for (const h of [730, 790, 810, 834]) {
      expect(fitFor(DEVICE_W, h).anchor).toBe("top");
    }
  });

  it("covers both axes when the width is short of the canvas", () => {
    const fit = fitFor(1024, 810);
    expect(fit.x * CANVAS_W).toBeCloseTo(1024, 6);
    expect(fit.y * CANVAS_H).toBeCloseTo(810, 6);
  });

  it("fits a Safari tab's real viewport instead of overshooting it", () => {
    // The trade here has inverted, and deliberately. With DEVICE_H as a floor,
    // a tab (~11% off-aspect, so inside FILL_TOLERANCE) got the pin too and the
    // board ran under the browser chrome — grey traded for clipping. Now a tab
    // is scaled to the viewport it actually has, so the board is whole and
    // there is frame grey below it.
    //
    // That is the right way round for two reasons. The tab is not the supported
    // configuration — docs/DEVICE-SETUP.md puts the board on the wall as a
    // home-screen app — and, more to the point, the code no longer has to
    // guess: glassAgrees can tell a tab from a standalone app, which is
    // something no aspect ratio or height comparison could ever do.
    const fit = fitFor(1080, 730);
    expect(fit.x * CANVAS_W).toBeCloseTo(1080, 6);
    expect(fit.y * CANVAS_H).toBeCloseTo(730, 6);
    expect(fit.y * CANVAS_H).toBeLessThan(DEVICE_H);
  });

  it("letterboxes an off-aspect desktop window rather than stretching it", () => {
    // A 16:9 laptop window is a dev preview, not the wall. A uniform scale
    // keeps the preview honest about the real layout.
    const fit = fitFor(1512, 850);
    expect(fit.x).toBe(fit.y);
    expect(fit.x).toBeCloseTo(850 / CANVAS_H, 10);
    expect(CANVAS_W * fit.x).toBeLessThan(1512);
  });

  it("never scales to zero on a frame it cannot measure", () => {
    expect(fitFor(0, 0)).toEqual({ x: 1, y: 1, anchor: "center" });
  });
});

describe("Fit", () => {
  it("anchors the canvas to the top of the frame on the device", () => {
    setViewport(DEVICE_W, DEVICE_H);
    const { device } = renderFit();

    expect(device.style.top).toBe("0px");
    expect(device.style.transform).toContain("translate(-50%, 0)");
    expect(scalesOf(device)).toEqual([1.2, 1.2]);
  });

  it("scales to the glass on the device's reported signature", () => {
    // The whole change, through a real render. The viewport reports 790 and
    // every rect in jsdom is zero, so the only reason this comes out at 1.2 is
    // that measureFrame consulted availHeight and the inset probe and found
    // them in agreement. Remove either witness and this drops to 790/675.
    setViewport(DEVICE_W, 790);
    const restore = withGlass({ availHeight: 810, insets: { top: 20 }, standalone: true });
    try {
      const { device } = renderFit();
      const [sx, sy] = scalesOf(device);

      expect(CANVAS_W * sx).toBeCloseTo(DEVICE_W, 6);
      expect(CANVAS_H * sy).toBe(DEVICE_H);
      expect(device.style.top).toBe("0px");
    } finally {
      restore();
    }
  });

  it("scales to the viewport when the insets cannot explain the gap", () => {
    // Same viewport, same availHeight, insets that do not add up — 790 + 0 is
    // not 810. The code declines the glass and scales to what it can actually
    // see, which is the fallback that keeps this from being a ninth guess.
    setViewport(DEVICE_W, 790);
    const restore = withGlass({ availHeight: 810, insets: {}, standalone: true });
    try {
      const { device } = renderFit();
      const [, sy] = scalesOf(device);

      expect(CANVAS_H * sy).toBeCloseTo(790, 6);
      expect(CANVAS_H * sy).not.toBe(DEVICE_H);
    } finally {
      restore();
    }
  });

  it("scales to the viewport in a browser tab, insets or not", () => {
    // navigator.standalone false with the device's own numbers otherwise. A
    // tab's shortfall is real, so it is honoured.
    setViewport(DEVICE_W, 790);
    const restore = withGlass({ availHeight: 810, insets: { top: 20 }, standalone: false });
    try {
      const { device } = renderFit();
      const [, sy] = scalesOf(device);

      expect(CANVAS_H * sy).toBeCloseTo(790, 6);
    } finally {
      restore();
    }
  });

  it("keeps centring a letterboxed dev window, where the grey is deliberate", () => {
    setViewport(1512, 850);
    const { device } = renderFit();

    expect(device.style.top).toBe("50%");
    expect(device.style.transform).toContain("translate(-50%, -50%)");
  });

  /*
    The frame's own box, which is what #58 left out and what made it a no-op on
    the wall.

    This inverts an assertion that stood from the pass before it: "leaves the
    frame's size to the stylesheet, so nothing can show behind it". That rule
    was written against a real failure — .fb-fit once carried a height measured
    from window.innerHeight, independently of the scale, and body's grey showed
    through in the gap whenever the two disagreed. What makes it safe to write
    an inline height now is that there is no longer a second number to
    disagree with: the frame's height and the canvas's vertical scale are the
    same derivation, out of the same call to measureFrame, and the assertions
    below check that by comparing them to each other rather than to a constant.

    The width stays off the frame. It has been correct at every step through
    `width: 100%` and there is nothing for JS to fix about it.
  */
  it("gives the frame the same height it scales the canvas against", () => {
    setViewport(DEVICE_W, 790);
    const restore = withGlass({ availHeight: 810, insets: { top: 20 }, standalone: true });
    try {
      const { fit, device } = renderFit();
      const [, sy] = scalesOf(device);

      // The frame reaches the glass, which `height: calc(100% + ...)` could
      // not: 100% on a position: fixed box resolves against the layout
      // viewport, and that is the 790 this device reports and glassAgrees
      // disbelieves.
      expect(fit.style.height).toBe(`${DEVICE_H}px`);
      // ...and it is the *same* number the canvas is scaled by, not a second
      // opinion about it. This is the property that retires the old rule.
      expect(CANVAS_H * sy).toBe(Number.parseFloat(fit.style.height));
      expect(fit.style.width).toBe("");
    } finally {
      restore();
    }
  });

  it("sizes the page's own boxes to that height too, so nothing clips above the glass", () => {
    // html's overflow: hidden propagates to the viewport, and the viewport
    // clip is the one clip in the page that reaches a position: fixed frame.
    // At height: 100% it lands on the layout viewport's 790 and cuts the last
    // 20px off a board that is otherwise covering the glass correctly.
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    setViewport(DEVICE_W, 790);
    const restore = withGlass({ availHeight: 810, insets: { top: 20 }, standalone: true });
    try {
      renderFit();

      expect(document.documentElement.style.height).toBe(`${DEVICE_H}px`);
      expect(document.body.style.height).toBe(`${DEVICE_H}px`);
      expect(root.style.height).toBe(`${DEVICE_H}px`);
    } finally {
      restore();
      root.remove();
    }
  });

  it("writes no height the stylesheet did not already resolve to, off the device", () => {
    // The off-device case is the check that this is a fix and not a new
    // tuning knob. With no glass corroboration the derivation returns
    // innerHeight, which is exactly what `height: 100%` resolved to in every
    // browser where the layout viewport is honest. Nothing moves.
    setViewport(1512, 850);
    const { fit } = renderFit();

    expect(fit.style.height).toBe("850px");
    expect(document.documentElement.style.height).toBe("850px");
    expect(fit.style.width).toBe("");
  });

  it("hands the page back to the stylesheet when the board unmounts", () => {
    setViewport(DEVICE_W, 790);
    const { unmount } = render(
      <Fit>
        <div className="fb-root" />
      </Fit>,
    );
    expect(document.documentElement.style.height).toBe("790px");

    unmount();

    expect(document.documentElement.style.height).toBe("");
    expect(document.body.style.height).toBe("");
  });

  it("scales before translating, so the canvas lands flush at any scale", () => {
    // The transform list composes as scale x translate, so -50% is scaled
    // with it, per axis. Written translate-first it would only be right at
    // scale 1.
    setViewport(900, 900);
    const { device } = renderFit();
    const transform = device.style.transform;

    expect(transform).toContain("translate(-50%, -50%)");
    expect(transform.indexOf("scale(")).toBeLessThan(transform.indexOf("translate("));
  });

  it("re-measures on resize", () => {
    setViewport(DEVICE_W, DEVICE_H);
    const { device } = renderFit();
    expect(scalesOf(device)).toEqual([1.2, 1.2]);

    // Off-aspect, so this crosses out of the covering branch into the
    // letterboxed one — the anchor has to follow the scale.
    setViewport(1512, 850);
    fireEvent(window, new Event("resize"));

    expect(scalesOf(device)).toEqual([850 / CANVAS_H, 850 / CANVAS_H]);
    expect(device.style.top).toBe("50%");
  });

  it("falls back to scale 1 when the frame reports zero", () => {
    setViewport(0, 0);
    const { device } = renderFit();

    expect(scalesOf(device)).toEqual([1, 1]);
  });
});
