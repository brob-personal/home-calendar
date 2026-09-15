import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";

import { Fit } from "./Fit.jsx";
import { diagRows, isColourProbeOn, setColourProbe, safeAreaInsets } from "./FitDiag.jsx";
import { BUILD_SHA } from "../../lib/build.js";

/*
  Cover for the instrumentation itself, which is a category of thing this
  repository has not had to test before.

  The point of these is narrow and worth stating, because it is not the usual
  reason for a test: the grey band along the bottom of the board has survived
  eight fixes, and the reason it could is that nothing on the wall said which
  build was running or which layer was painting. This instrumentation is the
  evidence-gathering apparatus for the ninth attempt. If the gesture does not
  fire, or the badge does not render, or the probe stylesheet is missing a
  colour, the readings come back unusable and there is no way to tell that from
  the readings — a diagnostic that fails silently is worse than none, because
  its output still looks like data.

  So these assert that the apparatus works, not that the board looks right.
  Nothing here is about the band.

  jsdom has no layout engine, so every getBoundingClientRect is 0x0 and env()
  resolves to nothing. That rules out asserting on any *value* the overlay
  reports — the values are the device's to supply. What is assertable here is
  that every labelled row exists, that the gesture toggles, and that the probe
  names every layer.
*/

const renderBoard = () =>
  render(
    <Fit>
      <div className="fb-root">
        <div className="fb-board">
          <main className="fb-stage" />
        </div>
      </div>
    </Fit>,
  );

/*
  Taps are counted from a capture-phase listener on the window with a
  coordinate test, so a tap is a pointerdown at a position — there is no element
  to aim at, which is the point of it.

  Built as a MouseEvent rather than through fireEvent.pointerDown, because
  jsdom implements no PointerEvent constructor: testing-library falls back to a
  bare Event, which carries no clientX, and the coordinate test then rejects
  every tap. MouseEvent is the nearest interface jsdom does implement that
  carries client coordinates, and the listener only reads the type and the
  coordinates.
*/
const tap = (times, x = 5, y = 5) => {
  for (let i = 0; i < times; i += 1) {
    fireEvent(window, new MouseEvent("pointerdown", { clientX: x, clientY: y, bubbles: true }));
  }
};

// The taps resolve after a quiet window rather than on the last one, so every
// gesture here has to wait that window out.
const settled = (assertion) => waitFor(assertion, { timeout: 2000 });

afterEach(() => setColourProbe(false));

describe("the build badge", () => {
  it("renders the running build's SHA without being asked", () => {
    const { container } = renderBoard();
    expect(container.textContent).toContain(BUILD_SHA);
  });

  it("is pinned to the bottom of the viewport, which is what makes it a probe", () => {
    // Not cosmetic. The badge's own bottom edge is the bottom of the layout
    // viewport; grey visible below it means the page never got those pixels.
    // A badge that floated anywhere else would answer nothing.
    const { container } = renderBoard();
    const badge = container.querySelector("[data-fb-build]");
    expect(badge.textContent).toContain(BUILD_SHA);
    expect(badge.style.position).toBe("fixed");
    expect(badge.style.bottom).toBe("0px");
    // And it must never eat a tap: it sits over the bottom-left of a board
    // where every control is meant to be tappable.
    expect(badge.style.pointerEvents).toBe("none");
  });
});

describe("the diagnostic gesture", () => {
  it("opens the overlay on three taps in the corner", async () => {
    renderBoard();
    expect(screen.queryByText("CLOSE")).not.toBeInTheDocument();

    tap(3);
    await settled(() => expect(screen.getByText("CLOSE")).toBeInTheDocument());
  });

  it("closes it on three more, since Guided Access offers nothing else", async () => {
    renderBoard();
    tap(3);
    await settled(() => expect(screen.getByText("CLOSE")).toBeInTheDocument());

    tap(3);
    await settled(() => expect(screen.queryByText("CLOSE")).not.toBeInTheDocument());
  });

  it("ignores a single tap, so the corner is not a hair trigger", async () => {
    renderBoard();
    tap(1);
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.queryByText("CLOSE")).not.toBeInTheDocument();
  });

  it("does not open the overlay on the way to a four-tap", async () => {
    // The whole reason the count resolves after a quiet window: acting on the
    // third tap would make the probe gesture open and then close the overlay.
    renderBoard();
    tap(4);
    await settled(() => expect(isColourProbeOn()).toBe(true));
    expect(screen.queryByText("CLOSE")).not.toBeInTheDocument();
  });

  it("ignores three taps outside the corner", async () => {
    renderBoard();
    tap(3, 400, 400);
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.queryByText("CLOSE")).not.toBeInTheDocument();
  });

  it("adds no dead zone to the corner it watches", async () => {
    // The reason the trigger is a window listener and not a transparent div.
    // Two full-canvas overlays reach into that corner and treat any tap as
    // meaningful — the screensaver wakes on one and SleepVeil counts them — so
    // a 56px hole in the corner of a sleeping board would be a behaviour
    // change. Nothing this component renders may cover that corner, and the
    // one thing it renders near an edge must not accept pointer events.
    const { container } = renderBoard();
    const covering = [...container.querySelectorAll("*")].filter(
      (node) =>
        node.style.position === "fixed" &&
        node.style.pointerEvents !== "none" &&
        !node.className.includes("fb-"),
    );
    expect(covering).toHaveLength(0);
  });

  it("toggles the colour probe off again on another four", async () => {
    renderBoard();
    tap(4);
    await settled(() => expect(isColourProbeOn()).toBe(true));

    tap(4);
    await settled(() => expect(isColourProbeOn()).toBe(false));
  });
});

describe("the colour probe", () => {
  it("gives every layer that could paint an edge a different colour", () => {
    setColourProbe(true);
    const css = document.getElementById("fb-colour-probe").textContent;

    // Each pairing is the whole point: the band's colour has to name one
    // element, so no two of these may match and none may be left out.
    expect(css).toMatch(/html\s*\{\s*background:\s*lime/);
    expect(css).toMatch(/body\s*\{\s*background:\s*orange/);
    expect(css).toMatch(/\.fb-fit\s*\{\s*background:\s*magenta/);
    expect(css).toMatch(/\.fb-stage\s*\{\s*background:\s*cyan/);
    // .fb-root is the fifth layer and not in the original four. Without it a
    // canvas box that reaches the glass would show magenta through a
    // transparent root and implicate the frame instead of the board.
    expect(css).toMatch(/\.fb-root\s*\{\s*background:\s*yellow/);
  });

  it("removes the gradient above them, or the colours are invisible", () => {
    setColourProbe(true);
    const css = document.getElementById("fb-colour-probe").textContent;
    expect(css).toMatch(/\.fb-art\s*\{\s*display:\s*none/);
    // The stage's cards paint solid fills over the very edge being
    // photographed.
    expect(css).toContain(".fb-stage *");
  });

  it("wins against React's inline styles, which own .fb-root and .fb-art", () => {
    // The previous version of this set inline styles imperatively. React
    // rewrites .fb-root's style attribute on every clock tick, so that was
    // reverted within a minute of being switched on. !important in a
    // stylesheet is the only form of this that survives a re-render.
    setColourProbe(true);
    const css = document.getElementById("fb-colour-probe").textContent;
    expect(css.match(/!important/g).length).toBe(css.match(/\{/g).length);
  });

  it("is idempotent in both directions and keeps its state in the DOM", () => {
    // Two entry points drive it — the gesture and the Settings button — and
    // neither owns the truth, so they cannot disagree about whether it is on.
    setColourProbe(true);
    setColourProbe(true);
    expect(document.querySelectorAll("#fb-colour-probe")).toHaveLength(1);
    expect(isColourProbeOn()).toBe(true);

    setColourProbe(false);
    setColourProbe(false);
    expect(isColourProbeOn()).toBe(false);
  });
});

describe("the readout", () => {
  it("names the build, so a photograph is evidence about a known build", () => {
    renderBoard();
    const rows = new Map(diagRows());
    expect(rows.get("sha")).toBe(BUILD_SHA);
    expect(rows.get("built")).toBeTruthy();
  });

  it("reports every signal the spec asks for, labelled", () => {
    renderBoard();
    const labels = diagRows().map(([label]) => label);
    for (const label of [
      "sha",
      "built",
      "window.inner",
      "doc.client",
      "visualViewport",
      "  vv detail",
      "screen",
      "screen.avail",
      "devicePixelRatio",
      "nav.standalone",
      "display-mode",
      "safe-area",
      ".fb-fit",
      ".fb-device",
      ".fb-root",
      ".fb-stage",
      "transform",
      "glass check",
      "computed fit",
      "measured",
      "w signals",
      "h signals",
      "glass derive",
      "html",
      "body",
      ".fb-art",
    ]) {
      expect(labels).toContain(label);
    }
  });

  it("gives all four edges of each box, not just its size", () => {
    // Which edge a discrepancy lands on is the question. A size alone cannot
    // distinguish 20px missing above the board from 20px missing below it.
    renderBoard();
    const rows = diagRows();
    const boxes = rows.slice(rows.findIndex(([l]) => l === "BOXES"));
    const fitRow = boxes.find(([label]) => label === ".fb-fit")[1];
    expect(fitRow).toMatch(/^l\S+ t\S+ r\S+ b\S+/);
  });

  /*
    The glass check is the one row here that renders a verdict rather than a
    number, so it is the one row whose *value* is worth asserting even in
    jsdom — and the only assertion in this repository that compares the page's
    own frame against the screen instead of against another part of the page.

    It replaces the property the tests carried through eight failed passes:
    "the canvas covers the frame on both axes", which stayed green the whole
    time the band was on screen because both sides of it came from the same
    wrong measurement. This one cannot be satisfied by self-consistency.
  */
  const withFitBottom = (bottom, availHeight) => {
    const origRect = Element.prototype.getBoundingClientRect;
    Object.defineProperty(window.screen, "availHeight", {
      value: availHeight,
      configurable: true,
    });
    Element.prototype.getBoundingClientRect = function patched() {
      if (this.classList?.contains("fb-fit")) {
        return { x: 0, y: 0, top: 0, left: 0, right: 1080, bottom, width: 1080, height: bottom };
      }
      return origRect.call(this);
    };
    return () => {
      Element.prototype.getBoundingClientRect = origRect;
      Object.defineProperty(window.screen, "availHeight", { value: 0, configurable: true });
    };
  };

  const glassRow = () => new Map(diagRows()).get("glass check");

  it("passes the glass check only when the frame reaches the bottom of the screen", () => {
    renderBoard();

    // The device's reported state: a frame ending at 790 against an 810 glass.
    // FAIL, and the delta names the size of the discrepancy in CSS px — which
    // at devicePixelRatio 2 is half the band in a photograph.
    let restore = withFitBottom(790, 810);
    try {
      expect(glassRow()).toContain("fb-fit.bottom 790");
      expect(glassRow()).toContain("availHeight 810");
      expect(glassRow()).toContain("delta 20");
      expect(glassRow()).toContain("FAIL");
    } finally {
      restore();
    }

    // The frame on the glass edge. PASS is exact equality, not a tolerance:
    // a tolerance here is how a 20px band passes a check written to catch it.
    restore = withFitBottom(810, 810);
    try {
      expect(glassRow()).toContain("delta 0");
      expect(glassRow()).toContain("PASS");
      expect(glassRow()).not.toContain("FAIL");
    } finally {
      restore();
    }
  });

  /*
    The acceptance bar for #59, as close to the device as jsdom can get.

    The test above stubs .fb-fit's bottom edge to a chosen number and checks
    glassCheck's arithmetic on it. That was the right test for #58 and it is
    why the check was trustworthy — but it is also why #58 could ship green and
    change nothing on the wall: nothing asserted that the frame *arrives* at
    810, only that the row would say PASS if it did.

    So this one does not choose a bottom edge. It emulates the one rule of
    layout that decides it — a `position: fixed` box at `top: 0` has
    `bottom === height` — and lets the height come from wherever the component
    actually put it. On the device's exact reported signature that is
    measureFrame's derivation, written inline by Fit.jsx, and the row reads
    PASS delta 0. Against the frame as it stood before this change the same
    emulation reads 790 off `height: calc(100% + env(...))` and the row reads
    FAIL delta 20, which is what the wall photographed.

    What it still cannot prove is that the band is gone: PASS here means the
    page's frame reaches the bottom of the glass, which is a necessary
    condition and not the whole of it. The overflow clip on html is the other
    half and jsdom has no clip to test. Fit.test.jsx covers the height that
    moves it; the device is what confirms the result.
  */
  const withLaidOutFrame = ({ availHeight, insets = {}, standalone = true }) => {
    const origRect = Element.prototype.getBoundingClientRect;
    const hadStandalone = "standalone" in window.navigator;
    const origStandalone = window.navigator.standalone;
    const origW = window.innerWidth;
    const origH = window.innerHeight;

    Object.defineProperty(window.screen, "availHeight", { value: availHeight, configurable: true });
    Object.defineProperty(window.navigator, "standalone", {
      value: standalone,
      configurable: true,
    });
    const rect = (width, height) => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
    });
    Element.prototype.getBoundingClientRect = function patched() {
      // The inset probe answers for itself — see safeAreaInsets.
      const side = this.dataset?.fbInset;
      if (side) return rect(0, insets[side] ?? 0);
      // The only layout rule being emulated: fixed, top: 0, so the bottom edge
      // is whatever height the element ended up with. Falling back to the
      // layout viewport is what `height: 100%` would have resolved to.
      if (this.classList?.contains("fb-fit")) {
        return rect(window.innerWidth, Number.parseFloat(this.style.height) || window.innerHeight);
      }
      return origRect.call(this);
    };

    return () => {
      Element.prototype.getBoundingClientRect = origRect;
      Object.defineProperty(window.screen, "availHeight", { value: 0, configurable: true });
      window.innerWidth = origW;
      window.innerHeight = origH;
      if (hadStandalone) {
        Object.defineProperty(window.navigator, "standalone", {
          value: origStandalone,
          configurable: true,
        });
      } else {
        delete window.navigator.standalone;
      }
    };
  };

  it("reads delta 0 on the device's signature, because the frame reaches the glass", () => {
    window.innerWidth = 1080;
    window.innerHeight = 790;
    const restore = withLaidOutFrame({ availHeight: 810, insets: { top: 20 }, standalone: true });
    try {
      renderBoard();

      expect(glassRow()).toContain("fb-fit.bottom 810");
      expect(glassRow()).toContain("availHeight 810");
      expect(glassRow()).toContain("delta 0");
      expect(glassRow()).toContain("PASS");
      expect(glassRow()).not.toContain("FAIL");
    } finally {
      restore();
    }
  });

  it("reports UNKNOWN rather than PASS where it cannot run", () => {
    // jsdom's screen.availHeight is 0 and every rect is 0x0, so `0 - 0 === 0`
    // would print a green PASS on every machine that cannot actually perform
    // the check. That is the exact class of false reassurance this row exists
    // to end, so a missing witness is named as missing.
    renderBoard();
    expect(glassRow()).toContain("UNKNOWN");
    expect(glassRow()).not.toContain("PASS");
  });

  it("reports the scale the code computed, not a fresh one", () => {
    // Recomputing would be a different observation, and a mismatch between
    // what the board is scaled to and what a fresh measurement returns is one
    // of the more interesting things this could show.
    renderBoard();
    const rows = new Map(diagRows());
    expect(rows.get("computed fit")).toMatch(/x \S+\s+y \S+\s+anchor (top|center)/);
    expect(rows.get("measures")).toMatch(/^[1-9]/);
  });

  it("lists each height signal by name beside the value that won", () => {
    renderBoard();
    const rows = new Map(diagRows());
    for (const name of ["rect", "innerHeight", "clientHeight", "visualViewport"]) {
      expect(rows.get("h signals")).toContain(name);
    }
  });

  it("measures the safe-area insets through layout rather than reading CSS text", () => {
    // There is no JS API for env(), and the CSS text reads back as the literal
    // `env(...)` call. Only a used value is an answer.
    const insets = safeAreaInsets();
    expect(Object.keys(insets).sort()).toEqual(["bottom", "left", "right", "top"]);
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(typeof insets[side]).toBe("number");
    }
    // And it leaves nothing behind in the document it measured.
    expect(document.body.querySelector('div[aria-hidden="true"]')).toBeNull();
  });
});
