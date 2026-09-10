import { describe, it, expect } from "vitest";
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

function renderDay(events) {
  return render(
    <DayView date={DATE} now={NOW} events={events} members={MEMBERS} settings={SETTINGS} onSelect={() => {}} />,
  );
}

function pct(style) {
  return Number(style.match(/calc\(([-\d.]+)% [+-] \d+px\)/)[1]);
}

/*
  Overlapping events in a day column used to stack directly on top of each
  other. layoutOverlaps (src/lib/layout.js) now splits the column's width
  evenly across whatever is overlapping — these tests cover the same
  scenarios layout.test.js proves at the pure-function level, checked here
  end to end through the rendered `.fb-dblock` buttons.
*/
describe("DayView overlap layout", () => {
  it("splits two overlapping events side by side", () => {
    renderDay([ev("a", "Standup", 9, 0, 10, 0), ev("b", "Sync", 9, 30, 10, 30)]);
    const a = screen.getByRole("button", { name: /Standup/ });
    const b = screen.getByRole("button", { name: /Sync/ });
    expect(pct(a.style.left)).toBe(0);
    expect(pct(a.style.width)).toBeCloseTo(50);
    expect(pct(b.style.left)).toBeCloseTo(50);
    expect(pct(b.style.width)).toBeCloseTo(50);
  });

  it("splits three mutually-overlapping events into three lanes", () => {
    renderDay([
      ev("a", "One", 9, 0, 10, 0),
      ev("b", "Two", 9, 0, 10, 0),
      ev("c", "Three", 9, 0, 10, 0),
    ]);
    const widths = ["One", "Two", "Three"].map(
      (name) => pct(screen.getByRole("button", { name: new RegExp(name) }).style.width),
    );
    for (const w of widths) expect(w).toBeCloseTo(100 / 3);
    const lefts = ["One", "Two", "Three"]
      .map((name) => pct(screen.getByRole("button", { name: new RegExp(name) }).style.left))
      .sort((x, y) => x - y);
    expect(lefts[0]).toBeCloseTo(0);
    expect(lefts[1]).toBeCloseTo((1 * 100) / 3);
    expect(lefts[2]).toBeCloseTo((2 * 100) / 3);
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
