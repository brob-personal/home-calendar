import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { MemberPicker } from "./MemberPicker.jsx";

/*
  Replaces Footer.test.jsx's legend coverage: the always-on avatar row is
  gone, folded into this popover, badge-counted by how many are shown.
*/
const MEMBERS = [
  { id: "a", name: "Ann", color: "#f00" },
  { id: "b", name: "Ben", color: "#0f0" },
];

function renderPicker(hidden = [], extra = {}) {
  const isShown = (id) => !hidden.includes(id);
  return render(
    <MemberPicker
      members={MEMBERS}
      isShown={isShown}
      onToggleMember={extra.onToggleMember || (() => {})}
      showReset={extra.showReset || false}
      onReset={extra.onReset || (() => {})}
    />,
  );
}

describe("MemberPicker", () => {
  it("badges the closed button with how many members are currently shown", () => {
    renderPicker(["b"]);
    expect(screen.getByRole("button", { name: /Choose whose calendars/ })).toHaveTextContent("1");
  });

  it("lists every member on open, regardless of shown state", () => {
    renderPicker(["b"]);
    fireEvent.click(screen.getByRole("button", { name: /Choose whose calendars/ }));
    expect(screen.getByRole("option", { name: /Ann/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Ben/ })).toBeInTheDocument();
  });

  it("toggles a member without closing the popover, so several can be tapped in a row", () => {
    const onToggleMember = vi.fn();
    renderPicker([], { onToggleMember });
    fireEvent.click(screen.getByRole("button", { name: /Choose whose calendars/ }));
    fireEvent.click(screen.getByRole("option", { name: /Ben/ }));
    expect(onToggleMember).toHaveBeenCalledWith("b");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("only shows Reset when the filter has been touched", () => {
    renderPicker([], { showReset: false });
    fireEvent.click(screen.getByRole("button", { name: /Choose whose calendars/ }));
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("shows and wires Reset when the filter has been touched", () => {
    const onReset = vi.fn();
    renderPicker([], { showReset: true, onReset });
    fireEvent.click(screen.getByRole("button", { name: /Choose whose calendars/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalled();
  });
});
