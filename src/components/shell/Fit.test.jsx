import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { Fit, fitFor } from "./Fit.jsx";
import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";

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

  So the property every assertion below is about: the canvas covers the frame
  exactly on both axes at anything near the device's aspect, and the frame is
  the viewport itself rather than a measured size that can come up short.

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
  it("resolves to 1:1 on the real device's 1080x810 viewport", () => {
    expect(fitFor(CANVAS_W, CANVAS_H)).toEqual({ x: 1, y: 1 });
  });

  it("covers both axes when the height is short of the canvas", () => {
    // The regression: 20px of status bar off the height. A uniform fit would
    // scale both axes to 790/810 and leave ~13px of frame grey down each
    // side. Each axis has to reach its own edge instead.
    const fit = fitFor(1080, 790);
    expect(fit.x * CANVAS_W).toBeCloseTo(1080, 6);
    expect(fit.y * CANVAS_H).toBeCloseTo(790, 6);
  });

  it("covers both axes when the width is short of the canvas", () => {
    const fit = fitFor(1024, 810);
    expect(fit.x * CANVAS_W).toBeCloseTo(1024, 6);
    expect(fit.y * CANVAS_H).toBeCloseTo(810, 6);
  });

  it("still covers exactly in a Safari tab, the worst on-device aspect", () => {
    // Board opened as a tab rather than from the home screen: tab strip plus
    // toolbar, ~11% off-aspect. Inside tolerance, so it still covers.
    const fit = fitFor(1080, 730);
    expect(fit.x * CANVAS_W).toBeCloseTo(1080, 6);
    expect(fit.y * CANVAS_H).toBeCloseTo(730, 6);
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
    expect(fitFor(0, 0)).toEqual({ x: 1, y: 1 });
  });
});

describe("Fit", () => {
  it("renders the canvas at scale 1 on the device viewport", () => {
    setViewport(CANVAS_W, CANVAS_H);
    const { device } = renderFit();

    expect(scalesOf(device)).toEqual([1, 1]);
  });

  it("leaves the frame's size to the stylesheet, so nothing can show behind it", () => {
    // The bottom band: .fb-fit used to carry an inline height measured from
    // window.innerHeight, which put body's grey in the gap whenever that came
    // up short. `position: fixed; inset: 0` in Fit.js owns the size now, and
    // is the layout viewport by definition — so there must be no inline size
    // here to contradict it.
    setViewport(1080, 790);
    const { fit } = renderFit();

    expect(fit.style.width).toBe("");
    expect(fit.style.height).toBe("");
  });

  it("covers the frame on both axes rather than letterboxing the sides", () => {
    setViewport(1080, 790);
    const { device } = renderFit();
    const [sx, sy] = scalesOf(device);

    expect(CANVAS_W * sx).toBeCloseTo(1080, 6);
    expect(CANVAS_H * sy).toBeCloseTo(790, 6);
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
    setViewport(CANVAS_W, CANVAS_H);
    const { device } = renderFit();
    expect(scalesOf(device)).toEqual([1, 1]);

    setViewport(540, 405);
    fireEvent(window, new Event("resize"));

    expect(scalesOf(device)).toEqual([0.5, 0.5]);
  });

  it("falls back to scale 1 when the frame reports zero", () => {
    setViewport(0, 0);
    const { device } = renderFit();

    expect(scalesOf(device)).toEqual([1, 1]);
  });
});
