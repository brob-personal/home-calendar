import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Composer } from "./Composer.jsx";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true }];
const DATE = new Date(2026, 2, 15);

const noop = () => {};

function renderComposer(settings, onSave = noop) {
  return render(
    <Composer members={MEMBERS} date={DATE} settings={settings} onSave={onSave} onClose={noop} />,
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
