import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/*
  R2: repointed from ../family-board.jsx to ./App.jsx. The import path and the
  local name are the only edits — every assertion below is R1's, unchanged, and
  all four still pass against the decomposed tree. That is the point of the
  file: if R2 had changed behaviour, these would have caught it.
*/
import FamilyBoard from "./App.jsx";

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

describe("Family Board scaffold smoke", () => {
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

    // Fit starts at scale 1, which is what the real 1080x810 device resolves
    // to. jsdom reports 0x0 for getBoundingClientRect, so the stubbed
    // ResizeObserver never fires a measurement that would clobber it.
    expect(device.getAttribute("style")).toContain("scale(1)");
  });

  it("declares the 1080x810 canvas contract in its stylesheet", async () => {
    const { container } = render(<FamilyBoard />);
    await screen.findByRole("button", { name: "Day" });

    // Asserted against the stylesheet text rather than computed layout: jsdom
    // does no real layout, and this is the dimension every downstream view is
    // tuned to. R5 must keep it true when the CSS string becomes tokens.
    const sheet = container.querySelector("style");
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain("1080px");
    expect(sheet.textContent).toContain("810px");
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
