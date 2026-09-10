import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { AgendaView } from "./AgendaView.jsx";
import { PaletteContext } from "../../state/PaletteContext.js";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8" }];
const palette = { fillFor: () => "#fff", firstColor: () => "#fff", byId: {}, palette: {} };

function allDayEv(id, title, startDate, endDate) {
  return { id, title, start: startDate, end: endDate, allDay: true, memberIds: ["brian"], variant: 0 };
}

function renderAgenda(date, events, onSelect = () => {}) {
  return render(
    <PaletteContext.Provider value={palette}>
      <AgendaView date={date} now={date} events={events} members={MEMBERS} onSelect={onSelect} />
    </PaletteContext.Provider>,
  );
}

/*
  A multi-day all-day event used to appear once, grouped under its start
  day, and vanish once that day passed even while still running. `relevant`/
  `instances` in AgendaView.jsx expand it into one row per remaining day.
*/
describe("AgendaView multi-day events", () => {
  it("still shows an event that started before today but is still running", () => {
    const today = new Date(2026, 2, 15);
    const trip = allDayEv("t", "Kauai", new Date(2026, 2, 12), new Date(2026, 2, 18));
    renderAgenda(today, [trip]);
    expect(screen.getAllByText("Kauai").length).toBeGreaterThan(0);
  });

  it("does not show an event that already ended before today", () => {
    const today = new Date(2026, 2, 15);
    const trip = allDayEv("t", "Kauai", new Date(2026, 2, 1), new Date(2026, 2, 5));
    renderAgenda(today, [trip]);
    expect(screen.queryByText("Kauai")).not.toBeInTheDocument();
  });

  it("lists a running multi-day event once per remaining day, under separate day groups", () => {
    const today = new Date(2026, 2, 15);
    const trip = allDayEv("t", "Kauai", new Date(2026, 2, 14), new Date(2026, 2, 17));
    renderAgenda(today, [trip]);
    // Runs 14th-17th; only today (15th) through the 17th are still ahead.
    expect(screen.getAllByText("Kauai")).toHaveLength(3);
  });

  it("opens the detail sheet from a later day's occurrence of the same event", () => {
    const today = new Date(2026, 2, 15);
    const onSelect = vi.fn();
    const trip = allDayEv("t", "Kauai", new Date(2026, 2, 14), new Date(2026, 2, 17));
    renderAgenda(today, [trip], onSelect);
    screen.getAllByRole("button", { name: /Kauai/ })[2].click();
    expect(onSelect).toHaveBeenCalledWith(trip);
  });
});
