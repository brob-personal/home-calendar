import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { HeaderControls } from "./HeaderControls.jsx";

/*
  Covers the pieces that are HeaderControls' own — the pager's stepAnchor
  wiring and the conditional chips — since ViewSwitcher/MemberPicker have
  their own test files.
*/
const noop = () => {};

function renderControls(overrides = {}) {
  return render(
    <HeaderControls
      degraded={false}
      isToday={true}
      onToday={noop}
      view="day"
      setView={noop}
      views={["day", "week", "month", "agenda"]}
      anchor={new Date(2026, 0, 15)}
      setAnchor={noop}
      roster={[]}
      isShown={() => true}
      onToggleMember={noop}
      filterTouched={false}
      onReset={noop}
      onSettings={noop}
      {...overrides}
    />,
  );
}

describe("HeaderControls", () => {
  it("steps the anchor one day back and forward in day view", () => {
    const setAnchor = vi.fn();
    renderControls({ setAnchor });
    screen.getByRole("button", { name: "Previous" }).click();
    expect(setAnchor).toHaveBeenCalledWith(new Date(2026, 0, 14));
    screen.getByRole("button", { name: "Next" }).click();
    expect(setAnchor).toHaveBeenCalledWith(new Date(2026, 0, 16));
  });

  it("steps a full week at a time in week view", () => {
    const setAnchor = vi.fn();
    renderControls({ view: "week", setAnchor });
    screen.getByRole("button", { name: "Next" }).click();
    expect(setAnchor).toHaveBeenCalledWith(new Date(2026, 0, 22));
  });

  it("hides Return to Today in the view dropdown when already on today", () => {
    renderControls({ isToday: true });
    fireEvent.click(screen.getByRole("button", { name: /Day/ }));
    expect(screen.queryByRole("option", { name: "Return to Today" })).not.toBeInTheDocument();
  });

  it("offers Return to Today in the view dropdown and calls onToday when paged away", () => {
    const onToday = vi.fn();
    renderControls({ isToday: false, onToday });
    fireEvent.click(screen.getByRole("button", { name: /Day/ }));
    fireEvent.click(screen.getByRole("option", { name: "Return to Today" }));
    expect(onToday).toHaveBeenCalled();
  });

  it("shows the Offline chip only when degraded", () => {
    renderControls({ degraded: true });
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("opens settings from the gear button", () => {
    const onSettings = vi.fn();
    renderControls({ onSettings });
    screen.getByRole("button", { name: "Open settings" }).click();
    expect(onSettings).toHaveBeenCalled();
  });

  it("hides its own home/member-picker icon for day, week, and month, which host their own", () => {
    for (const view of ["day", "week", "month"]) {
      const { unmount } = renderControls({ view });
      expect(
        screen.queryByRole("button", { name: /Choose whose calendars/ }),
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows its own home/member-picker icon for views without their own avatar row", () => {
    renderControls({ view: "agenda" });
    expect(screen.getByRole("button", { name: /Choose whose calendars/ })).toBeInTheDocument();
  });
});
