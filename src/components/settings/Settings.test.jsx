import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Settings } from "./Settings.jsx";
import { ModeContext } from "../../state/ModeContext.js";
import { DEFAULT_SETTINGS, DEFAULT_MEMBERS } from "../../contracts/defaults.js";

/*
  Unlike renderSettings() below, this wrapper keeps `settings` in real state
  so that a sequence of clicks compounds the way it does in the running app —
  needed to reproduce bugs that only show up across multiple interactions
  with the same still-mounted Settings instance.
*/
function renderStatefulSettings(settingsOverrides = {}, mode = "personal") {
  const modeState = {
    mode,
    setMode: vi.fn(),
    roster: [],
    views: [],
    isRoommate: mode === "roommate",
  };
  function Wrapper() {
    const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...settingsOverrides });
    return (
      <ModeContext.Provider value={modeState}>
        <Settings
          settings={settings}
          setSettings={setSettings}
          members={DEFAULT_MEMBERS}
          setMembers={vi.fn()}
          onClose={vi.fn()}
        />
      </ModeContext.Provider>
    );
  }
  return render(<Wrapper />);
}

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

  it("a calendar with exactly one owner shows on that person's row, not in Joint calendars", () => {
    const existing = {
      personal: [{ id: "solo@x.com", memberIds: [DEFAULT_MEMBERS[0].id], enabled: true }],
      roommate: [],
    };
    renderSettings({ calendars: existing });
    const soloInput = screen.getByDisplayValue("solo@x.com");
    expect(soloInput).toHaveAttribute("placeholder", "Calendar ID");
    expect(soloInput.closest(".fb-memberrow")).not.toBeNull();
    expect(
      within(screen.getByText("Joint calendars").closest(".fb-field")).queryByDisplayValue(
        "solo@x.com",
      ),
    ).not.toBeInTheDocument();
  });

  it("checks accessRole when a member's calendar id field is blurred, and merges the result", async () => {
    vi.stubEnv("VITE_BOARD_DEVICE_SECRET", "test-secret");
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ ok: true, accessRole: "reader" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const existing = {
      personal: [{ id: "brian@x.com", memberIds: [DEFAULT_MEMBERS[0].id], enabled: true }],
      roommate: [],
    };
    const setSettings = renderSettings({ calendars: existing });

    fireEvent.blur(screen.getByDisplayValue("brian@x.com"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const url = new URL(fetchSpy.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/calendar/access");
    expect(url.searchParams.get("calendarId")).toBe("brian@x.com");

    await waitFor(() => {
      const updater = setSettings.mock.calls.at(-1)[0];
      const result = updater({ ...DEFAULT_SETTINGS, calendars: existing });
      expect(result.calendars.personal[0].accessRole).toBe("reader");
    });

    vi.unstubAllEnvs();
  });

  it("does not check accessRole outside a real deployment (no device secret configured)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const existing = {
      personal: [{ id: "brian@x.com", memberIds: [DEFAULT_MEMBERS[0].id], enabled: true }],
      roommate: [],
    };
    renderSettings({ calendars: existing });

    fireEvent.blur(screen.getByDisplayValue("brian@x.com"));
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a calendar shared by two or more people still shows under Joint calendars", () => {
    const existing = {
      personal: [
        {
          id: "shared@x.com",
          memberIds: [DEFAULT_MEMBERS[0].id, DEFAULT_MEMBERS[1].id],
          enabled: true,
        },
      ],
      roommate: [],
    };
    renderSettings({ calendars: existing });
    expect(
      within(screen.getByText("Joint calendars").closest(".fb-field")).getByDisplayValue(
        "shared@x.com",
      ),
    ).toBeInTheDocument();
  });

  /*
    Regression guard: a brand-new joint calendar starts at 0 members, so
    checking the very first person used to drop it to exactly 1 member and
    the jointCalendars filter (memberIds.length !== 1) instantly hid the row
    — before the user could check a second name to make it actually joint.
    The row must stay put through that first click, and only settle into a
    single owner's row once Settings is closed and reopened.
  */
  it("checking a first name doesn't yank a new joint-calendar row out from under you", async () => {
    const user = userEvent.setup();
    renderStatefulSettings({ calendars: { personal: [], roommate: [] } });
    const jointField = screen.getByText("Joint calendars").closest(".fb-field");
    await user.click(within(jointField).getByRole("button", { name: "Add calendar" }));

    const first = DEFAULT_MEMBERS[0];
    const second = DEFAULT_MEMBERS[1];
    const row = within(jointField)
      .getByRole("checkbox", { name: first.name })
      .closest(".fb-memberblock");

    await user.click(within(row).getByRole("checkbox", { name: first.name }));
    expect(within(jointField).getByRole("checkbox", { name: first.name })).toBeInTheDocument();

    await user.click(within(row).getByRole("checkbox", { name: second.name }));
    expect(within(row).getByRole("checkbox", { name: first.name })).toBeChecked();
    expect(within(row).getByRole("checkbox", { name: second.name })).toBeChecked();
  });
});

/*
  Each person's own calendar id now lives on their row in the Family
  section, where the old per-person Photo URL field used to be — that field
  is gone, since R9's Drive folder id already covers photos.
*/
describe("Settings' per-person calendar id field", () => {
  it("has no Photo URL field left", () => {
    renderSettings();
    expect(screen.queryByPlaceholderText("Photo URL")).not.toBeInTheDocument();
  });

  it("typing a calendar id into a person's row creates a single-owner calendar entry", async () => {
    const user = userEvent.setup();
    const setSettings = renderSettings({ calendars: { personal: [], roommate: [] } });
    const member = DEFAULT_MEMBERS[0];
    const row = screen.getByDisplayValue(member.name).closest(".fb-memberrow");
    const calInput = within(row).getByPlaceholderText("Calendar ID");
    await user.type(calInput, "x");
    const updater = setSettings.mock.calls.at(-1)[0];
    const result = updater({ ...DEFAULT_SETTINGS, calendars: { personal: [], roommate: [] } });
    expect(result.calendars.personal).toEqual([
      { id: "x", memberIds: [member.id], enabled: true },
    ]);
  });

  it("clearing a person's calendar id removes their calendar entry entirely", async () => {
    const user = userEvent.setup();
    const member = DEFAULT_MEMBERS[0];
    const existing = {
      personal: [{ id: "solo@x.com", memberIds: [member.id], enabled: true }],
      roommate: [],
    };
    const setSettings = renderSettings({ calendars: existing });
    const row = screen.getByDisplayValue(member.name).closest(".fb-memberrow");
    const calInput = within(row).getByDisplayValue("solo@x.com");
    await user.clear(calInput);
    const updater = setSettings.mock.calls.at(-1)[0];
    expect(updater({ ...DEFAULT_SETTINGS, calendars: existing }).calendars.personal).toEqual([]);
  });
});
