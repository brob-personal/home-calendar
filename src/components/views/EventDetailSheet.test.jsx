import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EventDetailSheet } from "./EventDetailSheet.jsx";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8" }];
const SETTINGS = { dayStart: 7, dayEnd: 21 };
const noop = () => {};

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
  };
}

function multiDayEvent() {
  return {
    id: "e2",
    title: "Kauai",
    start: new Date(2026, 2, 15),
    end: new Date(2026, 2, 18), // 3-day span: 15th, 16th, 17th, 18th
    allDay: true,
    milestone: false,
    memberIds: ["brian"],
    variant: 0,
    location: "",
  };
}

function renderSheet(event, onSave = noop) {
  return render(
    <EventDetailSheet
      event={event}
      members={MEMBERS}
      settings={SETTINGS}
      onSave={onSave}
      onDelete={noop}
      onClose={noop}
    />,
  );
}

/*
  Previously `allDay` was only ever editable as a side effect of "Count down
  to this", and the sheet could never move a timed event to all-day or edit
  a multi-day span. Both are now real, independent controls.
*/
describe("EventDetailSheet All day editing", () => {
  it("reveals Ends and hides Starts/For once a timed event is switched to All day", async () => {
    const user = userEvent.setup();
    renderSheet(timedEvent());
    expect(screen.getByText("Starts")).toBeInTheDocument();
    expect(screen.queryByText("Ends")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "All day" }));

    expect(screen.queryByText("Starts")).not.toBeInTheDocument();
    expect(screen.getByText("Ends")).toBeInTheDocument();
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

  it("pre-fills Ends from an existing multi-day event's span", () => {
    renderSheet(multiDayEvent());
    expect(screen.getByRole("button", { name: "+3 days" })).toHaveClass("is-on");
  });

  it("saves an edited span for an existing multi-day event without moving its start day", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderSheet(multiDayEvent(), onSave);
    await user.click(screen.getByRole("button", { name: "+1 day" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const patch = onSave.mock.calls[0][0];
    expect(patch.allDay).toBe(true);
    expect(patch.start).toEqual(new Date(2026, 2, 15));
    expect(patch.end).toEqual(new Date(2026, 2, 16));
  });

  it("never shows All day or Ends for a milestone", () => {
    const milestone = { ...timedEvent(), allDay: true, milestone: true };
    renderSheet(milestone);
    expect(screen.queryByRole("checkbox", { name: "All day" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ends")).not.toBeInTheDocument();
  });
});
