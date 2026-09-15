import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { Fit, fitFor } from "./Fit.jsx";
import { CANVAS_W, CANVAS_H, DEVICE_W, DEVICE_H } from "../../lib/canvas.js";

/*
  Regression cover for the grey border that framed the board on iPad 7th gen.

  It was fixed in two passes. The first removed a ~10px grey sliver above the
  board (.fb-device's 1080x810 layout box overflowing a grid row that
  top-aligns) and four wedges of frame grey clipped out of the corners by a
  4px border-radius. What it left behind, and what these cover, is the grey
  the user still saw on the left, right and bottom:

    - sides, because a single uniform `Math.min` scale letterboxes whenever
      the frame is not exactly 4:3, and it never quite is;
    - bottom, because .fb-fit was sized to window.innerHeight and pinned at
      top: 0, so an innerHeight 20px short of the screen left body's
      identical #d9dbe0 showing in the gap beneath it.

  "The canvas covers the frame exactly on both axes" was the property these
  asserted for six passes, and it is the wrong one. It is satisfied just as
  well by a frame that is short of the glass as by one that is not, so every
  pass could hold it and still leave grey along the bottom — and the pass that
  finally closed the band by padding the frame satisfied it too, while pushing
  the calendar's last row and the note FAB off the screen.

  The property now is narrower and does not mention the frame: on a
  device-shaped frame, the canvas is DEVICE_H tall and starts at the frame's
  top edge. The panel is 2160x1620 at 2x, so the glass is 810 CSS px, and a
  675px canvas at 810/675 is 810 screen px from y=0 — the bottom edge lands on
  the bottom of the glass by construction rather than by measurement. The
  height assertions below are therefore about the scale *ignoring* what it was
  handed, which is the opposite of what they used to check.

  The width is still measured and still has to cover, which is what the
  remaining covering assertions are for. 900x675 onto 1080x810 must also come
  out a uniform 1.2x: non-uniform would mean the canvas and the panel aspects
  had drifted apart and the board was being stretched.

  jsdom has no layout engine, so getBoundingClientRect is 0x0 and <Fit> falls
  back to window.innerWidth/innerHeight — which is what setViewport drives.
  These check the values <Fit> computes, which is precisely where it went
  wrong. The flush-to-the-glass result itself belongs to R13's fixed-viewport
  visual pass.
*/

// jsdom's innerWidth/innerHeight are plain writable window properties.
function setViewport(w, h) {
  window.innerWidth = w;
  window.innerHeight = h;
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

  it("pins the height to the panel even on a frame the size of the canvas", () => {
    // Not 1:1 any more, and deliberately so: a frame this shape is read as
    // the wall iPad, and the wall iPad's glass is DEVICE_H regardless of what
    // the frame measured. The width still resolves to 1:1 here.
    const fit = fitFor(CANVAS_W, CANVAS_H);
    expect(fit.x).toBe(1);
    expect(fit.y * CANVAS_H).toBe(DEVICE_H);
    expect(fit.anchor).toBe("top");
  });

  it("ignores a short frame height rather than scaling the board to it", () => {
    // The whole six-pass regression in one assertion. 790 is the status bar
    // off the height, which is what the layout viewport reports on this
    // device; scaling the canvas to 790 is what left 20 screen px of grey
    // under the board. The canvas is 810 tall whatever the frame says.
    const fit = fitFor(1080, 790);
    expect(fit.x * CANVAS_W).toBeCloseTo(1080, 6);
    expect(fit.y * CANVAS_H).toBe(DEVICE_H);
    expect(fit.y * CANVAS_H).not.toBe(790);
  });

  it("treats the panel height as a floor, not a ceiling", () => {
    // Both directions of the same failure, which is why this is a `max` and
    // not a pin. A frame that reports short of the panel cannot shrink the
    // board below it — that was the grey band. A frame that honestly reports
    // *taller* than the panel still gets covered — which a pin could not do,
    // and which is the remaining candidate for the band surviving pass 7.
    for (const h of [750, 770, 790, 810]) {
      expect(fitFor(DEVICE_W, h).y * CANVAS_H).toBe(DEVICE_H);
    }
    for (const h of [834, 850, 900]) {
      expect(fitFor(DEVICE_W, h).y * CANVAS_H).toBeCloseTo(h, 6);
    }
    expect(fitFor(DEVICE_W, 790).anchor).toBe("top");
  });

  it("covers both axes when the width is short of the canvas", () => {
    const fit = fitFor(1024, 810);
    expect(fit.x * CANVAS_W).toBeCloseTo(1024, 6);
    expect(fit.y * CANVAS_H).toBeCloseTo(810, 6);
  });

  it("overshoots a Safari tab's viewport, which is the accepted trade", () => {
    // Pinning the height gives up one thing, and this is it, written down so
    // it is a decision rather than a surprise. A tab is ~11% off-aspect —
    // inside FILL_TOLERANCE, so it gets the pin — and the board is then
    // taller than the tab's visible area, so its bottom runs under the
    // browser chrome. That is Deferred Defect #11 coming back for tabs only.
    //
    // It is accepted because the code cannot tell "short because Safari
    // chrome" from "short because iPadOS under-reports the glass", and those
    // want opposite answers. docs/DEVICE-SETUP.md makes the home-screen app
    // the supported way to run the board, so the standalone case wins. If the
    // tab case ever matters, the discriminator is display-mode: standalone,
    // not a better guess at the height.
    const fit = fitFor(1080, 730);
    expect(fit.x * CANVAS_W).toBeCloseTo(1080, 6);
    expect(fit.y * CANVAS_H).toBe(DEVICE_H);
    expect(fit.y * CANVAS_H).toBeGreaterThan(730);
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
    // The anchor is what decides which edge a frame/glass discrepancy lands
    // on. Centred, it splits across both — which is how a 20px shortfall
    // became 10px of grey under the board and 10px of the header clipped
    // above it. Pinned to the top, the canvas starts on the glass's top edge
    // and, being DEVICE_H tall, ends on its bottom edge.
    setViewport(DEVICE_W, DEVICE_H);
    const { device } = renderFit();

    expect(device.style.top).toBe("0px");
    expect(device.style.transform).toContain("translate(-50%, 0)");
    expect(scalesOf(device)).toEqual([1.2, 1.2]);
  });

  it("keeps centring a letterboxed dev window, where the grey is deliberate", () => {
    setViewport(1512, 850);
    const { device } = renderFit();

    expect(device.style.top).toBe("50%");
    expect(device.style.transform).toContain("translate(-50%, -50%)");
  });

  it("leaves the frame's size to the stylesheet, so nothing can show behind it", () => {
    // The bottom band: .fb-fit used to carry an inline height measured from
    // window.innerHeight, which put body's grey in the gap whenever that came
    // up short. Nothing reads the frame's height for the vertical scale any
    // more, so Fit.js can own its size as a plain `inset: 0` — there must be
    // no inline size here to contradict it, and no amount of measuring may
    // put one back.
    setViewport(1080, 790);
    const { fit } = renderFit();

    expect(fit.style.width).toBe("");
    expect(fit.style.height).toBe("");
  });

  it("covers the frame's width and the glass's height on a short frame", () => {
    // 1080x790 is what the device actually reports. Width covers the frame;
    // height ignores it and covers the glass.
    setViewport(1080, 790);
    const { device } = renderFit();
    const [sx, sy] = scalesOf(device);

    expect(CANVAS_W * sx).toBeCloseTo(1080, 6);
    expect(CANVAS_H * sy).toBe(DEVICE_H);
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

    // Off-aspect, so this crosses out of the pinned branch into the
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
