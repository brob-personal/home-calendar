import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { WeekView } from "./WeekView.jsx";
import { PaletteContext } from "../../state/PaletteContext.js";

const SETTINGS = { dayStart: 7, dayEnd: 21 };
// A Sunday, so startOfWeek(DATE) === DATE and the events below land in "today"'s column.
const DATE = new Date(2026, 2, 15);
const NOW = DATE;

const palette = { fillFor: () => "#fff", firstColor: () => "#fff", byId: {}, palette: {} };

function ev(id, title, startH, startM, endH, endM) {
  return {
    id,
    title,
    start: new Date(2026, 2, 15, startH, startM),
    end: new Date(2026, 2, 15, endH, endM),
    allDay: false,
    memberIds: ["brian"],
    variant: 0,
  };
}

function renderWeek(events, onSelect = () => {}) {
  return render(
    <PaletteContext.Provider value={palette}>
      <WeekView date={DATE} now={NOW} events={events} settings={SETTINGS} onSelect={onSelect} />
    </PaletteContext.Provider>,
  );
}

function allDayEv(id, title, startDate, endDate) {
  return { id, title, start: startDate, end: endDate, allDay: true, memberIds: ["brian"], variant: 0 };
}

function pct(style) {
  return Number(style.match(/calc\(([-\d.]+)% [+-] \d+px\)/)[1]);
}

/*
  Same overlap-layout coverage as DayView.test.jsx, but through WeekView's
  per-day columns (`.fb-wblock`) rather than DayView's per-member ones —
  both share layoutOverlaps from src/lib/layout.js.
*/
describe("WeekView overlap layout", () => {
  it("cascades two overlapping events with a fixed width and offset", () => {
    renderWeek([ev("a", "Standup", 9, 0, 10, 0), ev("b", "Sync", 9, 30, 10, 30)]);
    const a = screen.getByRole("button", { name: /Standup/ });
    const b = screen.getByRole("button", { name: /Sync/ });
    expect(pct(a.style.left)).toBe(0);
    expect(pct(a.style.width)).toBeCloseTo(60);
    expect(a.style.zIndex).toBe("2");
    expect(pct(b.style.left)).toBeCloseTo(40);
    expect(pct(b.style.width)).toBeCloseTo(60);
    expect(b.style.zIndex).toBe("3");
  });

  it("cascades three mutually-overlapping events, compressing the step to fit", () => {
    renderWeek([
      ev("a", "One", 9, 0, 10, 0),
      ev("b", "Two", 9, 0, 10, 0),
      ev("c", "Three", 9, 0, 10, 0),
    ]);
    const one = screen.getByRole("button", { name: /One/ });
    const two = screen.getByRole("button", { name: /Two/ });
    const three = screen.getByRole("button", { name: /Three/ });
    for (const btn of [one, two, three]) expect(pct(btn.style.width)).toBeCloseTo(60);
    expect(pct(one.style.left)).toBeCloseTo(0);
    expect(pct(two.style.left)).toBeCloseTo(20);
    expect(pct(three.style.left)).toBeCloseTo(40);
  });

  it("compresses the step further for a 4-way overlap so the last event stays inside the column", () => {
    renderWeek([
      ev("a", "One", 9, 0, 10, 0),
      ev("b", "Two", 9, 0, 10, 0),
      ev("c", "Three", 9, 0, 10, 0),
      ev("d", "Four", 9, 0, 10, 0),
    ]);
    const four = screen.getByRole("button", { name: /Four/ });
    expect(pct(four.style.width)).toBeCloseTo(60);
    expect(pct(four.style.left) + pct(four.style.width)).toBeCloseTo(100);
  });

  it("renders a non-overlapping pair at full width", () => {
    renderWeek([ev("a", "Morning", 9, 0, 10, 0), ev("b", "Afternoon", 14, 0, 15, 0)]);
    expect(pct(screen.getByRole("button", { name: /Morning/ }).style.width)).toBe(100);
    expect(pct(screen.getByRole("button", { name: /Afternoon/ }).style.width)).toBe(100);
  });

  it("does not split events that only touch (one ends when the next starts)", () => {
    renderWeek([ev("a", "Before", 9, 0, 10, 0), ev("b", "After", 10, 0, 11, 0)]);
    expect(pct(screen.getByRole("button", { name: /Before/ }).style.width)).toBe(100);
    expect(pct(screen.getByRole("button", { name: /After/ }).style.width)).toBe(100);
  });
});

/*
  Week used to drop allDay events on the floor entirely — no banner row
  existed at all, so these events rendered nowhere in this view.
*/
describe("WeekView all-day row", () => {
  it("shows a single-day all-day event once, in its own day's column", () => {
    renderWeek([allDayEv("h", "Holiday", new Date(2026, 2, 16), new Date(2026, 2, 16))]);
    expect(screen.getAllByRole("button", { name: "Holiday" })).toHaveLength(1);
  });

  it("repeats a multi-day all-day event's chip across every day it spans within the visible week", () => {
    // Fri Mar 13 - Wed Mar 18; the visible week is Sun Mar 15 - Sat Mar 21,
    // so only 4 of the trip's 6 days (15, 16, 17, 18) fall in this week.
    renderWeek([allDayEv("t", "Kauai", new Date(2026, 2, 13), new Date(2026, 2, 18))]);
    expect(screen.getAllByRole("button", { name: "Kauai" })).toHaveLength(4);
  });

  it("opens the detail sheet when an all-day chip is tapped", () => {
    const onSelect = vi.fn();
    const holiday = allDayEv("h", "Holiday", new Date(2026, 2, 16), new Date(2026, 2, 16));
    renderWeek([holiday], onSelect);
    screen.getByRole("button", { name: "Holiday" }).click();
    expect(onSelect).toHaveBeenCalledWith(holiday);
  });
});
