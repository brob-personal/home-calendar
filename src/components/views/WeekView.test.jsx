import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

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
      <WeekView
        date={DATE}
        now={NOW}
        events={events}
        settings={SETTINGS}
        onSelect={onSelect}
        roster={[]}
        isShown={() => true}
        onToggleMember={() => {}}
        filterTouched={false}
        onReset={() => {}}
      />
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
  per-day columns (`.fb-wblock`) rather than DayView's per-member ones — both
  share layoutOverlaps from src/lib/layout.js.

  Week is the narrow case, and the one the bug was reported against: seven
  columns out of a 940px track is 134px each, which fits exactly one lane
  above the 96px min-width floor. So *any* overlap here collapses to one
  readable block plus a "+N" chip. That is the intended trade — two 67px
  half-columns cannot render "Test 3" and "10:00 - 11a" without wrapping and
  being sheared off by the block's height, which is the defect. Lower
  MIN_EVENT_COL_W in src/lib/layout.js if two-up Week columns are wanted back.
*/
const WEEK_COL_W = 940 / 7;

describe("WeekView overlap layout", () => {
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

  it("collapses an overlapping pair to one readable block plus a chip", () => {
    renderWeek([ev("a", "Standup", 9, 0, 10, 0), ev("b", "Sync", 9, 30, 10, 30)]);
    const a = screen.getByRole("button", { name: /Standup/ });
    expect(pct(a.style.left)).toBe(0);
    expect(pct(a.style.width)).toBeCloseTo(75);
    expect((pct(a.style.width) / 100) * WEEK_COL_W).toBeGreaterThanOrEqual(96);
    expect(screen.queryByRole("button", { name: /Sync/ })).toBeNull();
    expect(screen.getByRole("button", { name: /1 more event,/ })).toBeTruthy();
  });

  it("does not shrink the block further as the overlap deepens", () => {
    // The whole point of the floor: a 2-way and a 4-way overlap render the
    // surviving block at exactly the same width. Only the chip's count grows.
    renderWeek([
      ev("a", "One", 9, 0, 10, 0),
      ev("b", "Two", 9, 0, 10, 0),
      ev("c", "Three", 9, 0, 10, 0),
      ev("d", "Four", 9, 0, 10, 0),
    ]);
    const one = screen.getByRole("button", { name: /One/ });
    expect(pct(one.style.left)).toBe(0);
    expect(pct(one.style.width)).toBeCloseTo(75);
    expect(screen.getByRole("button", { name: /3 more events/ })).toBeTruthy();
  });

  it("puts the chip lane flush against the column's right edge", () => {
    renderWeek([ev("a", "Standup", 9, 0, 10, 0), ev("b", "Sync", 9, 30, 10, 30)]);
    const chip = screen.getByRole("button", { name: /1 more event,/ });
    expect(pct(chip.style.left) + pct(chip.style.width)).toBeCloseTo(100);
  });

  it("opens the whole slot when the chip is tapped, and routes a row to onSelect", () => {
    const onSelect = vi.fn();
    const events = [ev("a", "Standup", 9, 0, 10, 0), ev("b", "Sync", 9, 30, 10, 30)];
    renderWeek(events, onSelect);
    fireEvent.click(screen.getByRole("button", { name: /1 more event,/ }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("button", { name: /Standup/ })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: /Sync/ }));
    expect(onSelect).toHaveBeenCalledWith(events[1]);
    expect(screen.queryByRole("dialog")).toBeNull();
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
