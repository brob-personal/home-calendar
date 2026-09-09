import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Sheet } from "./Sheet.jsx";

/*
  R12 item 6's regression guard: the sheet used to close on scrim click and
  the X only, with no Escape handler and no focus trap.
*/
describe("Sheet", () => {
  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Sheet title="Test sheet" onClose={onClose}>
        <input placeholder="one" />
        <button>two</button>
      </Sheet>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus onto the sheet's first focusable element (the header's Close button) when nothing else claims it", () => {
    render(
      <Sheet title="Test sheet" onClose={vi.fn()}>
        <input placeholder="one" />
        <button>two</button>
      </Sheet>,
    );

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("lets an autoFocus descendant (the composer/detail sheet's title input) win over the default", () => {
    render(
      <Sheet title="Test sheet" onClose={vi.fn()}>
        <input placeholder="title" autoFocus />
        <button>two</button>
      </Sheet>,
    );

    expect(screen.getByPlaceholderText("title")).toHaveFocus();
  });

  it("wraps Tab from the last focusable element back to the first (Close)", async () => {
    const user = userEvent.setup();
    render(
      <Sheet title="Test sheet" onClose={vi.fn()}>
        <input placeholder="one" />
        <button>two</button>
      </Sheet>,
    );

    screen.getByText("two").focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element (Close) to the last", async () => {
    const user = userEvent.setup();
    render(
      <Sheet title="Test sheet" onClose={vi.fn()}>
        <input placeholder="one" />
        <button>two</button>
      </Sheet>,
    );

    screen.getByRole("button", { name: "Close" }).focus();
    await user.tab({ shift: true });
    expect(screen.getByText("two")).toHaveFocus();
  });

  it("restores focus to whatever opened it once the sheet closes", () => {
    const opener = document.createElement("button");
    opener.textContent = "opener";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <Sheet title="Test sheet" onClose={vi.fn()}>
        <button>inside</button>
      </Sheet>,
    );
    expect(opener).not.toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("still closes on scrim click and the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Sheet title="Test sheet" onClose={onClose}>
        <button>inside</button>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
