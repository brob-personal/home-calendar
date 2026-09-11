import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { Fit } from "./Fit.jsx";
import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";

/*
  Regression cover for the grey border that framed the board on iPad 7th gen.

  The cause was two different height sources in one chain: #root is
  `height: 100%` (the layout viewport, which viewport-fit=cover grows to the
  full screen) while .fb-fit was `height: 100dvh`. On the device those
  disagree by the 20pt status bar, and that 20px surfaced as frame grey on
  all four edges at once — sides from a scale derived off the short box, a
  top sliver from .fb-device overflowing a grid row that top-aligns, and a
  bottom band from body showing below a .fb-fit shorter than its parent.

  So the assertions below are all about one property: whatever the viewport,
  .fb-fit is exactly that size and the canvas is centred in it with the
  letterbox on at most one axis. jsdom has no layout engine, so these check
  the values <Fit> computes — the inline size and transform it writes — which
  is precisely where the old version went wrong.
*/

// jsdom's innerWidth/innerHeight are plain writable window properties, and
// they are <Fit>'s only input now.
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

const scaleOf = (device) => Number(device.style.transform.match(/scale\(([^)]+)\)/)[1]);

afterEach(() => setViewport(1024, 768));

describe("Fit", () => {
  it("resolves to scale 1 on the real device's 1080x810 viewport", () => {
    setViewport(CANVAS_W, CANVAS_H);
    const { fit, device } = renderFit();

    expect(scaleOf(device)).toBe(1);
    expect(fit.style.width).toBe("1080px");
    expect(fit.style.height).toBe("810px");
  });

  it("sizes .fb-fit to the viewport, so no ancestor height can show behind it", () => {
    // The device case that produced the bug: the canvas is 810 tall but the
    // viewport is 790, because viewport-fit=cover put the 20pt status bar in
    // the layout viewport. .fb-fit must be 790 — when it was `100dvh` against
    // a `100%` parent this is where body's identical grey leaked through.
    setViewport(1080, 790);
    const { fit } = renderFit();

    expect(fit.style.height).toBe("790px");
    expect(fit.style.width).toBe("1080px");
  });

  it("letterboxes on at most one axis — the binding axis fits exactly", () => {
    setViewport(1080, 790);
    const { device } = renderFit();
    const scale = scaleOf(device);

    // Height is the binding axis here, so the scaled canvas is exactly as
    // tall as the viewport: zero grey above or below, rather than the ~10px
    // sliver the old grid overflow left at the top.
    expect(scale).toBeCloseTo(790 / CANVAS_H, 10);
    expect(CANVAS_H * scale).toBeCloseTo(790, 6);
    expect(CANVAS_W * scale).toBeLessThan(1080);
  });

  it("scales before translating, so the canvas stays centred at any scale", () => {
    // The transform list composes as scale x translate, so -50% is scaled
    // with it and the canvas centres on .fb-fit's midpoint for every scale.
    // Written translate-first it would only be centred at scale 1.
    setViewport(900, 900);
    const { device } = renderFit();
    const transform = device.style.transform;

    expect(transform).toContain("translate(-50%, -50%)");
    expect(transform.indexOf("scale(")).toBeLessThan(transform.indexOf("translate("));
  });

  it("re-measures on resize, which the old ResizeObserver could not see", () => {
    // The previous version observed .fb-fit's own box. A viewport change that
    // did not resize that element left the scale stale; window events do not.
    setViewport(CANVAS_W, CANVAS_H);
    const { fit, device } = renderFit();
    expect(scaleOf(device)).toBe(1);

    setViewport(540, 405);
    fireEvent(window, new Event("resize"));

    expect(scaleOf(device)).toBe(0.5);
    expect(fit.style.height).toBe("405px");
  });

  it("falls back to the stylesheet's size when the viewport reports zero", () => {
    // Nothing trustworthy to scale against yet: leave .fb-fit on its CSS
    // 100dvh fallback rather than collapsing it to 0x0.
    setViewport(0, 0);
    const { fit, device } = renderFit();

    expect(fit.getAttribute("style")).toBeNull();
    expect(scaleOf(device)).toBe(1);
  });
});
