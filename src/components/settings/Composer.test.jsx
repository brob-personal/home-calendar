import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Composer } from "./Composer.jsx";
import { ModeContext } from "../../state/ModeContext.js";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true }];
const DATE = new Date(2026, 2, 15);

const noop = () => {};

/*
  Second arg is either an onSave spy directly (the common case — most tests
  only care what got saved) or an options object for the calendar-warning
  tests below, which also need to override `members` and hand ModeContext a
  specific `calendars` list.
*/
function renderComposer(settings, second = {}) {
  const options = typeof second === "function" ? { onSave: second } : second;
  const { members = MEMBERS, calendars = [], onSave = noop } = options;
  const modeState = { mode: "personal", setMode: noop, roster: members, calendars, views: [], isRoommate: false };
  return render(
    <ModeContext.Provider value={modeState}>
      <Composer members={members} date={DATE} settings={settings} onSave={onSave} onClose={noop} />
    </ModeContext.Provider>,
  );
}

/*
  Deferred Defect #4's regression guard: the hour picker used to be hardcoded
  to 6am-10pm regardless of settings.
*/
describe("Composer's hour picker", () => {
  it("offers exactly [dayStart, dayEnd) — the default 7-21 window", () => {
    renderComposer({ dayStart: 7, dayEnd: 21 });
    expect(screen.getByRole("button", { name: "7a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8p" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "6a" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "9p" })).not.toBeInTheDocument();
  });

  it("follows a board configured for a 5am start, which the old hardcoded range could never offer", () => {
    renderComposer({ dayStart: 5, dayEnd: 9 });
    expect(screen.getByRole("button", { name: "5a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8a" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "9a" })).not.toBeInTheDocument();
  });
});

/*
  The write path (google.js) only inserts into a member's own calendar when
  its accessRole is writer/owner. This is the warning that keeps the user
  from being surprised, after the fact, that a selection did nothing on
  someone else's real calendar.
*/
describe("Composer's read-only calendar warning", () => {
  const MEMBERS_TWO = [
    { id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true },
    { id: "rachel", name: "Rachel", color: "#F0A3B8", onBoard: true },
  ];
  const CALENDARS = [
    { id: "brian@x.com", memberIds: ["brian"], enabled: true, accessRole: "writer" },
    { id: "rachel@x.com", memberIds: ["rachel"], enabled: true, accessRole: "reader" },
  ];

  it("shows nothing for a member whose calendar is writable", () => {
    renderComposer({ dayStart: 7, dayEnd: 21 }, { members: MEMBERS_TWO, calendars: CALENDARS });
    expect(screen.queryByText(/won.t be added/i)).not.toBeInTheDocument();
  });

  it("appears once a read-only member is toggled on, and disappears once toggled back off", async () => {
    const user = userEvent.setup();
    renderComposer({ dayStart: 7, dayEnd: 21 }, { members: MEMBERS_TWO, calendars: CALENDARS });

    expect(screen.queryByText(/won.t be added to rachel/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rachel/i }));
    expect(screen.getByText(/won.t be added to rachel.*view access/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rachel/i }));
    expect(screen.queryByText(/won.t be added to rachel/i)).not.toBeInTheDocument();
  });

  it("warns for a selected member with no calendar linked at all, not just a read-only one", async () => {
    const user = userEvent.setup();
    const members = [
      { id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true },
      { id: "david", name: "David", color: "#8ED9B2", onBoard: true },
    ];
    renderComposer(
      { dayStart: 7, dayEnd: 21 },
      { members, calendars: [CALENDARS[0]] }, // only brian has a calendar link
    );

    await user.click(screen.getByRole("button", { name: /david/i }));
    expect(screen.getByText(/won.t be added to david/i)).toBeInTheDocument();
  });
});

/*
  Previously `allDay` only ever became true as a side effect of "Count down
  to this" (milestone), so there was no way to author a plain multi-day
  all-day event. "All day" is now its own checkbox with its own day-range.
*/
describe("Composer's All day toggle", () => {
  const SETTINGS = { dayStart: 7, dayEnd: 21 };

  it("hides Starts/For and reveals Ends once All day is checked", async () => {
    const user = userEvent.setup();
    renderComposer(SETTINGS);
    expect(screen.getByText("Starts")).toBeInTheDocument();
    expect(screen.queryByText("Ends")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "All day" }));

    expect(screen.queryByText("Starts")).not.toBeInTheDocument();
    expect(screen.getByText("Ends")).toBeInTheDocument();
  });

  it("saves a single-day all-day event with start === end when Ends is left on Same day", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderComposer(SETTINGS, onSave);
    await user.type(screen.getByPlaceholderText("What is it?"), "Holiday");
    await user.click(screen.getByRole("checkbox", { name: "All day" }));
    await user.click(screen.getByRole("button", { name: "Add event" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const draft = onSave.mock.calls[0][0];
    expect(draft.allDay).toBe(true);
    expect(draft.start).toEqual(new Date(2026, 2, 15));
    expect(draft.end).toEqual(new Date(2026, 2, 15));
  });

  it("saves a multi-day all-day event spanning the chosen start and end days", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderComposer(SETTINGS, onSave);
    await user.type(screen.getByPlaceholderText("What is it?"), "Kauai");
    await user.click(screen.getByRole("checkbox", { name: "All day" }));
    // "Day" pills: index 0 is "That day" (Mar 15); pick Wed Mar 18 as the start.
    const dayField = screen.getByText("Day").closest(".fb-field");
    await user.click(within(dayField).getByRole("button", { name: "Wed 18" }));
    // "Ends" pills only offer days from the chosen start onward.
    const endsField = screen.getByText("Ends").closest(".fb-field");
    await user.click(within(endsField).getByRole("button", { name: "Fri 20" }));
    await user.click(screen.getByRole("button", { name: "Add event" }));

    const draft = onSave.mock.calls[0][0];
    expect(draft.allDay).toBe(true);
    expect(draft.start).toEqual(new Date(2026, 2, 18));
    expect(draft.end).toEqual(new Date(2026, 2, 20));
  });

  it("keeps a milestone single-day: Ends never appears for a countdown", async () => {
    const user = userEvent.setup();
    renderComposer(SETTINGS);
    await user.click(screen.getByRole("checkbox", { name: "Count down to this on the board" }));
    expect(screen.queryByText("Ends")).not.toBeInTheDocument();
    expect(screen.queryByText("Starts")).not.toBeInTheDocument();
  });
});
