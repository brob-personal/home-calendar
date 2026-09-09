import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Settings } from "./Settings.jsx";
import { ModeContext } from "../../state/ModeContext.js";
import { DEFAULT_SETTINGS, DEFAULT_MEMBERS } from "../../contracts/defaults.js";

function renderSettings(settingsOverrides = {}, mode = "personal") {
  const setSettings = vi.fn();
  const modeState = {
    mode,
    setMode: vi.fn(),
    roster: [],
    views: [],
    isRoommate: mode === "roommate",
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

/*
  The Calendars section was missing entirely: DEPLOY.md step 7 tells the
  operator to add a calendar under each mode via settings.calendars[mode],
  but there was no UI to do it.
*/
describe("Settings' Calendars section", () => {
  it("adding a calendar appends an empty entry to the active mode's list", async () => {
    const user = userEvent.setup();
    const setSettings = renderSettings({ calendars: { personal: [], roommate: [] } });
    await user.click(screen.getByRole("button", { name: "Add calendar" }));
    const updater = setSettings.mock.calls.at(-1)[0];
    expect(updater(DEFAULT_SETTINGS).calendars.personal).toEqual([
      { id: "", memberIds: [], enabled: true },
    ]);
  });

  it("removing a calendar row filters it out of the active mode's list", async () => {
    const user = userEvent.setup();
    const existing = {
      personal: [{ id: "family@x.com", memberIds: [], enabled: true }],
      roommate: [],
    };
    const setSettings = renderSettings({ calendars: existing });
    const calRow = screen.getByDisplayValue("family@x.com").closest(".fb-memberblock");
    await user.click(within(calRow).getByRole("button", { name: "Remove" }));
    const updater = setSettings.mock.calls.at(-1)[0];
    expect(updater({ ...DEFAULT_SETTINGS, calendars: existing }).calendars.personal).toEqual([]);
  });

  it("scopes calendars separately per mode", () => {
    const settingsOverrides = {
      calendars: {
        personal: [{ id: "family@x.com", memberIds: [], enabled: true }],
        roommate: [],
      },
    };
    renderSettings(settingsOverrides, "roommate");
    expect(screen.queryByDisplayValue("family@x.com")).not.toBeInTheDocument();
  });

  it("adding a calendar in Roommate mode appends to the roommate list, not personal", async () => {
    const user = userEvent.setup();
    const existing = {
      personal: [{ id: "family@x.com", memberIds: [], enabled: true }],
      roommate: [],
    };
    const setSettings = renderSettings({ calendars: existing }, "roommate");
    await user.click(screen.getByRole("button", { name: "Add calendar" }));
    const updater = setSettings.mock.calls.at(-1)[0];
    const result = updater({ ...DEFAULT_SETTINGS, calendars: existing });
    expect(result.calendars.roommate).toEqual([{ id: "", memberIds: [], enabled: true }]);
    expect(result.calendars.personal).toEqual(existing.personal);
  });
});
