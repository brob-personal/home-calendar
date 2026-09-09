import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useModeState } from "./ModeContext.js";
import { DEFAULT_SETTINGS } from "../contracts/defaults.js";

/*
  PLAN.md §R10 acceptance: "Toggling swaps calendars, roster and colours
  wholesale. The choice survives reload. The To-do tab appears in Roommate
  mode and is absent in Personal mode."

  useModeState is the one function all of that runs through, so it is tested
  directly rather than through App — the App-level wiring (which prop gets
  `roster` instead of `members`) is a thin, visually-checked pass, but the
  derivation itself — which members are on the roster, which views exist,
  which calendar set is active — has to be exactly right for every mode.
*/

const MEMBERS = [
  { id: "brian", name: "Brian", color: "#7EB6E8", photo: "", onBoard: true, modes: ["personal"] },
  { id: "rachel", name: "Rachel", color: "#F0A3B8", photo: "", onBoard: true, modes: ["personal"] },
  { id: "sam", name: "Sam", color: "#8ED9B2", photo: "", onBoard: true, modes: ["roommate"] },
  {
    id: "alex",
    name: "Alex",
    color: "#F6C58A",
    photo: "",
    onBoard: true,
    modes: ["personal", "roommate"],
  },
];

function settingsFor(mode, overrides = {}) {
  return {
    ...DEFAULT_SETTINGS,
    mode,
    calendars: {
      personal: [{ id: "family@group.calendar.google.com", memberIds: ["brian", "rachel"], enabled: true }],
      roommate: [{ id: "roomies@group.calendar.google.com", memberIds: ["sam"], enabled: true }],
    },
    ...overrides,
  };
}

describe("useModeState", () => {
  it("narrows the roster to the active mode — the roommates are not the family", () => {
    const { result } = renderHook(() => useModeState(MEMBERS, settingsFor("personal"), vi.fn()));
    expect(result.current.roster.map((m) => m.id)).toEqual(["brian", "rachel", "alex"]);
    expect(result.current.isRoommate).toBe(false);
  });

  it("swaps to the roommate roster and calendars when the mode is roommate", () => {
    const { result } = renderHook(() => useModeState(MEMBERS, settingsFor("roommate"), vi.fn()));
    expect(result.current.roster.map((m) => m.id)).toEqual(["sam", "alex"]);
    expect(result.current.calendars).toEqual(settingsFor("roommate").calendars.roommate);
    expect(result.current.isRoommate).toBe(true);
  });

  it("offers the To-do tab in Roommate mode only", () => {
    const personal = renderHook(() => useModeState(MEMBERS, settingsFor("personal"), vi.fn()));
    expect(personal.result.current.views).toEqual(["day", "week", "month", "agenda"]);

    const roommate = renderHook(() => useModeState(MEMBERS, settingsFor("roommate"), vi.fn()));
    expect(roommate.result.current.views).toEqual(["day", "week", "month", "agenda", "todo"]);
  });

  it("writes the new mode through setSettings, keyed by the settings field R3 persists", () => {
    const setSettings = vi.fn();
    const { result } = renderHook(() => useModeState(MEMBERS, settingsFor("personal"), setSettings));

    act(() => result.current.setMode("roommate"));

    expect(setSettings).toHaveBeenCalledTimes(1);
    const updater = setSettings.mock.calls[0][0];
    expect(updater(settingsFor("personal")).mode).toBe("roommate");
  });

  it("ignores an unknown mode rather than persisting garbage", () => {
    const setSettings = vi.fn();
    const { result } = renderHook(() => useModeState(MEMBERS, settingsFor("personal"), setSettings));

    act(() => result.current.setMode("guest"));

    expect(setSettings).not.toHaveBeenCalled();
  });

  it("re-setting the already-active mode returns the same settings object, not a copy", () => {
    const setSettings = vi.fn();
    const { result } = renderHook(() => useModeState(MEMBERS, settingsFor("personal"), setSettings));

    act(() => result.current.setMode("personal"));

    const updater = setSettings.mock.calls[0][0];
    const s = settingsFor("personal");
    expect(updater(s)).toBe(s);
  });

  it("falls back to the first mode if settings.mode is somehow invalid", () => {
    const { result } = renderHook(() =>
      useModeState(MEMBERS, settingsFor("not-a-real-mode"), vi.fn()),
    );
    expect(result.current.mode).toBe("personal");
  });
});
