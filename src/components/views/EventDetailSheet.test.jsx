import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EventDetailSheet } from "./EventDetailSheet.jsx";
import { ModeContext } from "../../state/ModeContext.js";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8" }];
const SETTINGS = { timeFormat: "12" };
const noop = () => {};
const modeState = { mode: "personal", setMode: noop, roster: MEMBERS, calendars: [], views: [], isRoommate: false };

function timedEvent() {
  return {
    id: "e1",
    title: "Standup",
    start: new Date(2026, 2, 15, 9, 0),
    end: new Date(2026, 2, 15, 9, 30),
    allDay: false,
    milestone: false,
    memberIds: ["brian"],
    variant: 0,
    location: "",
    description: "",
  };
}

function multiDayEvent() {
  return {
    id: "e2",
    title: "Kauai",
    start: new Date(2026, 2, 15),
    end: new Date(2026, 2, 18),
    allDay: true,
    milestone: false,
    memberIds: ["brian"],
    variant: 0,
    location: "",
    description: "",
  };
}

function renderSheet(event, onSave = noop, onDelete = noop) {
  return render(
    <ModeContext.Provider value={modeState}>
      <EventDetailSheet
        event={event}
        members={MEMBERS}
        settings={SETTINGS}
        onSave={onSave}
        onDelete={onDelete}
        onClose={noop}
      />
    </ModeContext.Provider>,
  );
}

describe("EventDetailSheet", () => {
  it("pre-fills the title, date and times from the event", () => {
    renderSheet(timedEvent());
    expect(screen.getByPlaceholderText("Add title")).toHaveValue("Standup");
    expect(screen.getByLabelText("Start time")).toHaveTextContent("9a");
    expect(screen.getByLabelText("End time")).toHaveTextContent("9:30a");
  });

  it("reveals the end-date field for an already multi-day all-day event", () => {
    renderSheet(multiDayEvent());
    expect(screen.getByLabelText("End date")).toHaveTextContent("Wednesday, March 18");
  });

  it("saves a timed event switched to All day without moving its start day", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderSheet(timedEvent(), onSave);
    await user.click(screen.getByRole("checkbox", { name: "All day" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const patch = onSave.mock.calls[0][0];
    expect(patch.allDay).toBe(true);
    expect(patch.start).toEqual(new Date(2026, 2, 15));
    expect(patch.end).toEqual(new Date(2026, 2, 15));
  });

  it("delete requires a two-step confirm", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderSheet(timedEvent(), noop, onDelete);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this event?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("a milestone still shows the All day checkbox (unchanged, always-checked-in-effect state) but hides times and the end date", () => {
    const milestone = { ...timedEvent(), allDay: true, milestone: true };
    renderSheet(milestone);
    /* Unlike the pre-redesign EventDetailSheet (which hid "All day" for a
       milestone) and matching Composer's own pre-redesign behavior (which
       never hid it), EventForm renders "All day" unconditionally — a
       milestone forces allDay semantics but the spec only asks to hide the
       time fields and the end-date control, never the checkbox itself. */
    expect(screen.getByRole("checkbox", { name: "All day" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });
});
