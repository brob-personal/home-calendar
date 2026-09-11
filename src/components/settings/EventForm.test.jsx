import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EventForm, deriveTimingState } from "./EventForm.jsx";
import { ModeContext } from "../../state/ModeContext.js";

describe("deriveTimingState", () => {
  it("splits a single-day timed event into its date and two minute-of-day values", () => {
    const initial = {
      start: new Date(2026, 8, 9, 9, 0),
      end: new Date(2026, 8, 9, 9, 30),
      allDay: false,
    };
    expect(deriveTimingState(initial)).toEqual({
      startDate: new Date(2026, 8, 9),
      startMinutes: 9 * 60,
      endDate: new Date(2026, 8, 9),
      endMinutes: 9 * 60 + 30,
      endDateTouched: false,
    });
  });

  it("marks endDateTouched for an event that is already multi-day", () => {
    const initial = {
      start: new Date(2026, 8, 9, 22, 0),
      end: new Date(2026, 8, 10, 2, 0),
      allDay: false,
    };
    const s = deriveTimingState(initial);
    expect(s.endDate).toEqual(new Date(2026, 8, 10));
    expect(s.endDateTouched).toBe(true);
  });

  it("defaults to a sane 9-10am window for an all-day event, not midnight", () => {
    const initial = { start: new Date(2026, 8, 9), end: new Date(2026, 8, 9), allDay: true };
    const s = deriveTimingState(initial);
    expect(s.startMinutes).toBe(9 * 60);
    expect(s.endMinutes).toBe(10 * 60);
  });
});

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true }];
const SETTINGS = { timeFormat: "12" };
const INITIAL = {
  title: "",
  memberIds: ["brian"],
  variant: 0,
  start: new Date(2026, 8, 9, 8, 0),
  end: new Date(2026, 8, 9, 9, 0),
  allDay: false,
  milestone: false,
  location: "",
  description: "",
};

function renderForm(initial = INITIAL, renderFooter = () => null) {
  const modeState = { mode: "personal", setMode: () => {}, roster: MEMBERS, calendars: [], views: [], isRoommate: false };
  return render(
    <ModeContext.Provider value={modeState}>
      <EventForm
        initial={initial}
        members={MEMBERS}
        settings={SETTINGS}
        placeholderTitle="New event"
        renderFooter={renderFooter}
      />
    </ModeContext.Provider>,
  );
}

describe("EventForm's multi-day auto-detection", () => {
  it("has no end-date field for a normal same-day event", () => {
    renderForm();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });

  it("reveals the end-date field, defaulted to the next day, once the end time is at or before the start", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: /^7a\s/ })); // before the 8am start
    expect(screen.getByLabelText("End date")).toHaveTextContent("Thursday, September 10");
  });

  it("collapses the end-date field again if the end time moves back after the start, while untouched", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: /^7a\s/ }));
    expect(screen.getByLabelText("End date")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: /^10a\s/ })); // after the 8am start again
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });

  it("stops auto-collapsing once the end-date popover has been used directly", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: /^7a\s/ })); // reveals the end-date field
    await user.click(screen.getByLabelText("End date"));
    await user.click(screen.getByRole("button", { name: "20" })); // Sep 20, explicit pick
    expect(screen.getByLabelText("End date")).toHaveTextContent("Sunday, September 20");

    // Now push the end time back above the start time — a touched span must not collapse.
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: /^10a\s/ }));
    expect(screen.getByLabelText("End date")).toHaveTextContent("Sunday, September 20");
  });

  it("All day reuses the same end-date field for an already multi-day span", () => {
    const multiDayAllDay = {
      ...INITIAL,
      allDay: true,
      start: new Date(2026, 8, 9),
      end: new Date(2026, 8, 12),
    };
    renderForm(multiDayAllDay);
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toHaveTextContent("Saturday, September 12");
  });

  it("checking All day on a same-day timed event hides times without revealing an end date", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("checkbox", { name: "All day" }));
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });

  it("a milestone forces single-day and hides the end-date field even if it was showing", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: /^7a\s/ }));
    expect(screen.getByLabelText("End date")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Count down to this on the board" }));
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
  });

  it("assembles start/end from the date+minutes state on save", async () => {
    const user = userEvent.setup();
    let lastDraft = null;
    renderForm(INITIAL, (draft) => {
      lastDraft = draft;
      return (
        <button onClick={() => {}} disabled={!draft.title}>
          save probe
        </button>
      );
    });
    await user.type(screen.getByPlaceholderText("Add title"), "Standup");
    expect(lastDraft.title).toBe("Standup");
    expect(lastDraft.start).toEqual(new Date(2026, 8, 9, 8, 0));
    expect(lastDraft.end).toEqual(new Date(2026, 8, 9, 9, 0));
  });

  it("bumps end forward a day when the start date catches up to a touched end date, leaving the end time behind it", async () => {
    const user = userEvent.setup();
    let lastDraft = null;
    renderForm(INITIAL, (draft) => {
      lastDraft = draft;
      return null;
    });

    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: /^7a\s/ })); // auto-reveals end date as Sep 10 (before the 8am start)

    await user.click(screen.getByLabelText("End date"));
    await user.click(screen.getByRole("button", { name: "15" })); // explicit pick, Sep 15 — endDateTouched becomes true

    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(screen.getByRole("button", { name: "20" })); // start date moves past the touched end date, pulling endDate up to match

    expect(lastDraft.start).toEqual(new Date(2026, 8, 20, 8, 0));
    expect(lastDraft.end.getTime()).toBeGreaterThan(lastDraft.start.getTime());
    expect(lastDraft.end).toEqual(new Date(2026, 8, 21, 7, 0));
  });

  it("bumps end forward a day when the end-date popover explicitly picks the start day itself", async () => {
    const user = userEvent.setup();
    let lastDraft = null;
    renderForm(INITIAL, (draft) => {
      lastDraft = draft;
      return null;
    });

    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: /^7a\s/ })); // auto-reveals end date as Sep 10 (before the 8am start)

    await user.click(screen.getByLabelText("End date"));
    await user.click(screen.getByRole("button", { name: "9" })); // explicit pick of the start day itself — allowed, minDate={startDate}

    expect(lastDraft.start).toEqual(new Date(2026, 8, 9, 8, 0));
    expect(lastDraft.end.getTime()).toBeGreaterThan(lastDraft.start.getTime());
    expect(lastDraft.end).toEqual(new Date(2026, 8, 10, 7, 0));
  });
});
