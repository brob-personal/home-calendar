import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { DayView } from "./DayView.jsx";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8" }];
const SETTINGS = { dayStart: 7, dayEnd: 21 };
const DATE = new Date(2026, 2, 15);
const NOW = new Date(2026, 2, 15, 12, 0);

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

function renderDay(events, onSelect = () => {}) {
  return render(
    <DayView date={DATE} now={NOW} events={events} members={MEMBERS} settings={SETTINGS} onSelect={onSelect} />,
  );
}

function allDayEv(id, title, startDate, endDate) {
  return { id, title, start: startDate, end: endDate, allDay: true, memberIds: ["brian"], variant: 0 };
}

function pct(style) {
  return Number(style.match(/calc\(([-\d.]+)% [+-] \d+px\)/)[1]);
}

/*
  Overlapping events in a day column used to stack directly on top of each
  other, then (in a follow-up) got squished via an even width split that was
  too narrow to read. layoutOverlaps (src/lib/layout.js) now cascades
  overlapping events instead — fixed readable width, staggered offset,
  compressed only when a group is deep enough to overflow. These tests cover
  the same scenarios layout.test.js proves at the pure-function level,
  checked here end to end through the rendered `.fb-dblock` buttons.
*/
describe("DayView overlap layout", () => {
  it("cascades two overlapping events with a fixed width and offset", () => {
    renderDay([ev("a", "Standup", 9, 0, 10, 0), ev("b", "Sync", 9, 30, 10, 30)]);
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
    renderDay([
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
    expect(one.style.zIndex).toBe("2");
    expect(two.style.zIndex).toBe("3");
    expect(three.style.zIndex).toBe("4");
  });

  it("compresses the step further for a 4-way overlap so the last event stays inside the column", () => {
    renderDay([
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
    renderDay([ev("a", "Morning", 9, 0, 10, 0), ev("b", "Afternoon", 14, 0, 15, 0)]);
    expect(pct(screen.getByRole("button", { name: /Morning/ }).style.width)).toBe(100);
    expect(pct(screen.getByRole("button", { name: /Afternoon/ }).style.width)).toBe(100);
  });

  it("does not split events that only touch (one ends when the next starts)", () => {
    renderDay([ev("a", "Before", 9, 0, 10, 0), ev("b", "After", 10, 0, 11, 0)]);
    expect(pct(screen.getByRole("button", { name: /Before/ }).style.width)).toBe(100);
    expect(pct(screen.getByRole("button", { name: /After/ }).style.width)).toBe(100);
  });
});

/*
  Multi-day all-day events used to render their chip only on `e.start`'s
  day — DATE (Mar 15 2026) is inside, not the start of, each trip below, so
  these would have shown nothing before the `spansDay` fix.
*/
describe("DayView all-day chips", () => {
  it("shows a chip for a multi-day event that spans, but doesn't start on, the viewed day", () => {
    renderDay([allDayEv("t", "Kauai", new Date(2026, 2, 12), new Date(2026, 2, 19))]);
    expect(screen.getByRole("button", { name: "Kauai" })).toBeInTheDocument();
  });

  it("does not show a chip for a multi-day event whose span doesn't reach the viewed day", () => {
    renderDay([allDayEv("t", "Kauai", new Date(2026, 2, 1), new Date(2026, 2, 5))]);
    expect(screen.queryByRole("button", { name: "Kauai" })).not.toBeInTheDocument();
  });

  it("opens the detail sheet when a chip is tapped", () => {
    const onSelect = vi.fn();
    const trip = allDayEv("t", "Kauai", new Date(2026, 2, 12), new Date(2026, 2, 19));
    renderDay([trip], onSelect);
    screen.getByRole("button", { name: "Kauai" }).click();
    expect(onSelect).toHaveBeenCalledWith(trip);
  });
});
