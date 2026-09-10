import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Composer } from "./Composer.jsx";
import { ModeContext } from "../../state/ModeContext.js";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true }];

const noop = () => {};

function renderComposer(settings, { members = MEMBERS, calendars = [] } = {}) {
  const modeState = { mode: "personal", setMode: noop, roster: members, calendars, views: [], isRoommate: false };
  return render(
    <ModeContext.Provider value={modeState}>
      <Composer members={members} date={new Date(2026, 2, 15)} settings={settings} onSave={noop} onClose={noop} />
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
