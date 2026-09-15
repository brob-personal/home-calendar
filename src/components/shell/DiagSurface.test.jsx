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
      "computed fit",
      "measured",
      "w signals",
      "h signals",
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
