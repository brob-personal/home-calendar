import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { MonthView } from "./MonthView.jsx";
import { PaletteContext } from "../../state/PaletteContext.js";

const DATE = new Date(2026, 2, 15); // March 2026
const NOW = DATE;

const palette = { fillFor: () => "#fff", firstColor: () => "#fff", byId: {}, palette: {} };

function allDayEv(id, title, startDate, endDate) {
  return { id, title, start: startDate, end: endDate, allDay: true, memberIds: ["brian"], variant: 0 };
}

function timedEv(id, title, day, startH, endH) {
  return {
    id,
    title,
    start: new Date(2026, 2, day, startH, 0),
    end: new Date(2026, 2, day, endH, 0),
    allDay: false,
    memberIds: ["brian"],
    variant: 0,
  };
}

function renderMonth(events, onSelect = () => {}) {
  return render(
    <PaletteContext.Provider value={palette}>
      <MonthView date={DATE} now={NOW} events={events} onPick={() => {}} onSelect={onSelect} />
    </PaletteContext.Provider>,
  );
}

/*
  MonthView used to filter every cell with `sameDay(e.start, d)`, so a
  multi-day all-day event (a trip, a holiday) only ever showed a chip on the
  first day's cell. `spansDay` fixes that; these lock the fix in.
*/
describe("MonthView multi-day chips", () => {
  it("shows a chip in every cell an all-day event spans", () => {
    renderMonth([allDayEv("t", "Kauai", new Date(2026, 2, 12), new Date(2026, 2, 15))]);
    expect(screen.getAllByText("Kauai")).toHaveLength(4);
  });

  it("still shows a timed event only on its own day", () => {
    renderMonth([timedEv("s", "Standup", 12, 9, 10)]);
    expect(screen.getAllByText("Standup")).toHaveLength(1);
  });

  it("opens the detail sheet when a chip from a spanned day is tapped", () => {
    const onSelect = vi.fn();
    const trip = allDayEv("t", "Kauai", new Date(2026, 2, 12), new Date(2026, 2, 15));
    renderMonth([trip], onSelect);
    // Tap the chip rendered on the 14th, not the trip's start day.
    screen.getAllByText("Kauai")[2].click();
    expect(onSelect).toHaveBeenCalledWith(trip);
  });
});
