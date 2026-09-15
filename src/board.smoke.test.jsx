import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/*
  R2: repointed from ../family-board.jsx to ./App.jsx. The import path and the
  local name are the only edits — every assertion below is R1's, unchanged, and
  all four still pass against the decomposed tree. That is the point of the
  file: if R2 had changed behaviour, these would have caught it.
*/
import FamilyBoard from "./App.jsx";
import { CANVAS_W, CANVAS_H, DEVICE_W, DEVICE_H } from "./lib/canvas.js";

/*
  R1's scaffold smoke test: proof that the toolchain can mount the untouched
  prototype in jsdom and that the board survives a first paint plus a pass
  through all four views.

  This is intentionally shallow. It asserts the scaffold works, not that the
  board is correct — filter propagation, sleep/wake, the midnight wrap, colour
  clamps and the fixed-viewport 1080x810 visual pass all belong to R13, which
  owns the suite from Wave 0 onward and inherits this file.

  It must keep passing through R2's decomposition. If R2 breaks it, R2 changed
  behaviour, which its mandate forbids.
*/

const VIEWS = ["Day", "Week", "Month", "Agenda"];

// jsdom's innerWidth/innerHeight are plain writable properties on window, so
// <Fit>'s only input can be set directly. Restored after each test by the
// afterEach below — jsdom's own defaults are 1024x768.
function setViewport(w, h) {
  window.innerWidth = w;
  window.innerHeight = h;
}

describe("Family Board scaffold smoke", () => {
  afterEach(() => setViewport(1024, 768));

  it("mounts and renders the board shell", async () => {
    const user = userEvent.setup();
    render(<FamilyBoard />);

    // findBy* rather than getBy*: the root component loads events through
    // source.list() in an effect, so the first commit is followed by an async
    // state update.
    expect(await screen.findByRole("button", { name: "Day" })).toBeInTheDocument();

    // Day is the active view, shown as the switcher's own button label; the
    // rest only appear once the switcher's popover is open.
    await user.click(screen.getByRole("button", { name: "Day" }));
    for (const view of VIEWS.filter((v) => v !== "Day")) {
      expect(screen.getByRole("option", { name: view })).toBeInTheDocument();
    }

    expect(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument();
  });

  it("renders the fixed canvas inside the Fit scaler", async () => {
    // Pinned to the real panel so the scale below is the device contract
    // rather than an artefact of jsdom's 1024x768 default. jsdom has no
    // layout engine, so .fb-fit's rect reads 0x0 and Fit falls back to
    // window.innerWidth/innerHeight — which makes this the input that
    // decides the scale.
    setViewport(DEVICE_W, DEVICE_H);

    const { container } = render(<FamilyBoard />);
    await screen.findByRole("button", { name: "Day" });

    const fit = container.querySelector(".fb-fit");
    const device = container.querySelector(".fb-device");
    const root = container.querySelector(".fb-root");

    expect(fit).not.toBeNull();
    expect(device).not.toBeNull();
    expect(root).not.toBeNull();
    expect(fit).toContainElement(device);
    expect(device).toContainElement(root);

    // The canvas is 900x675 against a 1080x810 panel, both 4:3, so the board
    // covers the device at a uniform 1.2x — no letterbox on either axis, and
    // 20% larger than the canvas's own units. This is the whole reason the
    // canvas is smaller than the screen it ships on; see src/lib/canvas.js.
    const expected = DEVICE_W / CANVAS_W;
    expect(expected).toBe(DEVICE_H / CANVAS_H);
    expect(device.getAttribute("style")).toContain(`scale(${expected})`);
  });

  it("declares the canvas contract in its stylesheet", async () => {
    const { container } = render(<FamilyBoard />);
    await screen.findByRole("button", { name: "Day" });

    // Asserted against the stylesheet text rather than computed layout: jsdom
    // does no real layout, and this is the dimension every downstream view is
    // tuned to. R5 must keep it true when the CSS string becomes tokens.
    const sheet = container.querySelector("style");
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain(`${CANVAS_W}px`);
    expect(sheet.textContent).toContain(`${CANVAS_H}px`);
  });

  it("switches through every view without crashing", async () => {
    const user = userEvent.setup();
    render(<FamilyBoard />);
    await screen.findByRole("button", { name: "Day" });

    const viewPill = () => screen.getByRole("button", { name: /^(Day|Week|Month|Agenda)$/ });
    expect(viewPill()).toHaveTextContent("Day");

    for (const view of VIEWS) {
      if (viewPill().textContent.trim() === view) continue;
      await user.click(viewPill());
      await user.click(screen.getByRole("option", { name: view }));
      expect(viewPill()).toHaveTextContent(view);
    }
  });
});
