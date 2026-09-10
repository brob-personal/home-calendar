import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Composer } from "./Composer.jsx";
import { ModeContext } from "../../state/ModeContext.js";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true }];
const DATE = new Date(2026, 2, 15);
const noop = () => {};

function renderComposer(second = {}) {
  const options = typeof second === "function" ? { onSave: second } : second;
  const { members = MEMBERS, calendars = [], onSave = noop } = options;
  const modeState = { mode: "personal", setMode: noop, roster: members, calendars, views: [], isRoommate: false };
  return render(
    <ModeContext.Provider value={modeState}>
      <Composer members={members} date={DATE} settings={{ timeFormat: "12" }} onSave={onSave} onClose={noop} />
    </ModeContext.Provider>,
  );
}

describe("Composer", () => {
  it("defaults to a 6-8pm... actually 6-7pm same-day event on the given date", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderComposer(onSave);
    await user.type(screen.getByPlaceholderText("Add title"), "Standup");
    await user.click(screen.getByRole("button", { name: "Add event" }));

    const draft = onSave.mock.calls[0][0];
    expect(draft.start).toEqual(new Date(2026, 2, 15, 18, 0));
    expect(draft.end).toEqual(new Date(2026, 2, 15, 19, 0));
  });

  it("keeps the Add button disabled until a title is entered", () => {
    renderComposer();
    expect(screen.getByRole("button", { name: "Add event" })).toBeDisabled();
  });

  it("Cancel calls onClose without saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <ModeContext.Provider value={{ mode: "personal", setMode: noop, roster: MEMBERS, calendars: [], views: [], isRoommate: false }}>
        <Composer members={MEMBERS} date={DATE} settings={{ timeFormat: "12" }} onSave={onSave} onClose={onClose} />
      </ModeContext.Provider>,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows the read-only-calendar warning for a toggled member with no write access", async () => {
    const user = userEvent.setup();
    const members = [
      { id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true },
      { id: "rachel", name: "Rachel", color: "#F0A3B8", onBoard: true },
    ];
    const calendars = [
      { id: "brian@x.com", memberIds: ["brian"], enabled: true, accessRole: "writer" },
      { id: "rachel@x.com", memberIds: ["rachel"], enabled: true, accessRole: "reader" },
    ];
    renderComposer({ members, calendars });

    expect(screen.queryByText(/won.t be added/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /rachel/i }));
    expect(screen.getByText(/won.t be added to rachel.*view access/i)).toBeInTheDocument();
  });

  it("saves an all-day event spanning the picked start and end days", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderComposer(onSave);
    await user.type(screen.getByPlaceholderText("Add title"), "Kauai");
    await user.click(screen.getByRole("checkbox", { name: "All day" }));
    await user.click(screen.getByLabelText("Event date"));
    await user.click(screen.getByRole("button", { name: "18" }));
    // Untouched end date follows the start date for a same-day all-day event.
    await user.click(screen.getByRole("button", { name: "Add event" }));

    const draft = onSave.mock.calls[0][0];
    expect(draft.allDay).toBe(true);
    expect(draft.start).toEqual(new Date(2026, 2, 18));
    expect(draft.end).toEqual(new Date(2026, 2, 18));
  });

  it("keeps a milestone single-day", async () => {
    const user = userEvent.setup();
    renderComposer();
    await user.click(screen.getByRole("checkbox", { name: "Count down to this on the board" }));
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });
});
