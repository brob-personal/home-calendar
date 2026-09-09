import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Settings } from "./Settings.jsx";
import { ModeContext } from "../../state/ModeContext.js";
import { DEFAULT_SETTINGS, DEFAULT_MEMBERS } from "../../contracts/defaults.js";

function renderSettings(settingsOverrides = {}) {
  const setSettings = vi.fn();
  const modeState = {
    mode: "personal",
    setMode: vi.fn(),
    roster: [],
    views: [],
    isRoommate: false,
  };
  render(
    <ModeContext.Provider value={modeState}>
      <Settings
        settings={{ ...DEFAULT_SETTINGS, ...settingsOverrides }}
        setSettings={setSettings}
        members={DEFAULT_MEMBERS}
        setMembers={vi.fn()}
        onClose={vi.fn()}
      />
    </ModeContext.Provider>,
  );
  return setSettings;
}

/*
  Deferred Defect #16's regression guard: the Sleep section used to have no
  way to pick "black" (only the 0-0.4 dim slider) and no way to edit
  wakeTapSeconds at all.
*/
describe("Settings' Sleep section", () => {
  it("offers a Black/Dim choice and hides the dim slider under Black", () => {
    renderSettings({ sleepStyle: "black" });
    expect(screen.getByRole("button", { name: "Black" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dim" })).toBeInTheDocument();
    expect(screen.queryByText("Brightness while asleep")).not.toBeInTheDocument();
  });

  it("shows the dim slider under Dim", () => {
    renderSettings({ sleepStyle: "dim", sleepDim: 0.2 });
    expect(screen.getByText("Brightness while asleep")).toBeInTheDocument();
  });

  it("picking Black calls setSettings with sleepStyle: black", async () => {
    const user = userEvent.setup();
    const setSettings = renderSettings({ sleepStyle: "dim" });
    await user.click(screen.getByRole("button", { name: "Black" }));
    const updater = setSettings.mock.calls.at(-1)[0];
    expect(updater(DEFAULT_SETTINGS).sleepStyle).toBe("black");
  });

  it("wakeTapSeconds is editable, not just displayed", () => {
    renderSettings({ wakeTapSeconds: 90 });
    const input = screen.getByDisplayValue("90");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("min", "5");
    expect(input).toHaveAttribute("max", "3600");
  });
});
