import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

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

const PICKER_PROPS = {
  roster: MEMBERS,
  isShown: () => true,
  onToggleMember: () => {},
  filterTouched: false,
  onReset: () => {},
};

function renderDay(events, onSelect = () => {}) {
  return render(
    <DayView
      date={DATE}
      now={NOW}
      events={events}
      members={MEMBERS}
      settings={SETTINGS}
      onSelect={onSelect}
      {...PICKER_PROPS}
    />,
  );
}

function allDayEv(id, title, startDate, endDate) {
  return { id, title, start: startDate, end: endDate, allDay: true, memberIds: ["brian"], variant: 0 };
}

function pct(style) {
  return Number(style.match(/calc\(([-\d.]+)% [+-] \d+px\)/)[1]);
}

/*
  Overlapping events in a day column have been laid out three ways. They used
  to stack directly on top of each other; then they got an even width split
  with no floor, which at three or four deep was too narrow to render a title
  in; then a fixed-width rightward cascade, which kept the boxes nominally
  wide but let each one cover the right edge of the one before it, so the
  same text was hidden by a different mechanism.

  What layoutOverlaps (src/lib/layout.js) does now: split the column evenly,
  but never below MIN_EVENT_COL_W px, and collapse whatever no longer fits
  into a "+N" chip. These tests cover that through the rendered `.fb-dblock`
  buttons; layout.test.js proves the arithmetic at the pure-function level.

  MEMBERS is one member, so Day's column here is the full 940px track and
  fits nine columns at the floor — which is why the even-split cases below
  need a second render with five members to reach the overflow branch at all.
*/
describe("DayView overlap layout", () => {
  it("splits two overlapping events evenly, side by side", () => {
    renderDay([ev("a", "Standup", 9, 0, 10, 0), ev("b", "Sync", 9, 30, 10, 30)]);
    const a = screen.getByRole("button", { name: /Standup/ });
    const b = screen.getByRole("button", { name: /Sync/ });
    expect(pct(a.style.left)).toBe(0);
    expect(pct(a.style.width)).toBeCloseTo(50);
    expect(pct(b.style.left)).toBeCloseTo(50);
    expect(pct(b.style.width)).toBeCloseTo(50);
  });

  it("splits three mutually-overlapping events into three even columns", () => {
    renderDay([
      ev("a", "One", 9, 0, 10, 0),
      ev("b", "Two", 9, 0, 10, 0),
      ev("c", "Three", 9, 0, 10, 0),
    ]);
    const one = screen.getByRole("button", { name: /One/ });
    const two = screen.getByRole("button", { name: /Two/ });
    const three = screen.getByRole("button", { name: /Three/ });
    for (const btn of [one, two, three]) expect(pct(btn.style.width)).toBeCloseTo(100 / 3);
    expect(pct(one.style.left)).toBeCloseTo(0);
    expect(pct(two.style.left)).toBeCloseTo(100 / 3);
    expect(pct(three.style.left)).toBeCloseTo(200 / 3);
  });

  it("no longer stacks boxes on each other, so every block shares one z-index", () => {
    // The cascade needed an escalating z so later events drew on top. Even
    // columns do not overlap, so they do not need one — and not escalating
    // keeps a deep group from climbing over the now-line at z 4.
    renderDay([
      ev("a", "One", 9, 0, 10, 0),
      ev("b", "Two", 9, 0, 10, 0),
      ev("c", "Three", 9, 0, 10, 0),
    ]);
    for (const name of [/One/, /Two/, /Three/]) {
      expect(screen.getByRole("button", { name }).style.zIndex).toBe("2");
    }
  });

  it("keeps a 4-way overlap inside the column", () => {
    renderDay([
      ev("a", "One", 9, 0, 10, 0),
      ev("b", "Two", 9, 0, 10, 0),
      ev("c", "Three", 9, 0, 10, 0),
      ev("d", "Four", 9, 0, 10, 0),
    ]);
    const four = screen.getByRole("button", { name: /Four/ });
    expect(pct(four.style.width)).toBeCloseTo(25);
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
  The overflow branch, which needs a column narrow enough to reach it: five
  members puts a Day column at 188px, room for exactly one lane above the
  96px floor. The events all belong to `brian`, so they crowd one column
  while the other four read "Free".
*/
const CROWD = [
  { id: "brian", name: "Brian", color: "#7EB6E8" },
  { id: "sam", name: "Sam", color: "#E8A87E" },
  { id: "kim", name: "Kim", color: "#A87EE8" },
  { id: "lee", name: "Lee", color: "#7EE8A8" },
  { id: "ash", name: "Ash", color: "#E87EA8" },
];

function renderCrowdedDay(events, onSelect = () => {}) {
  return render(
    <DayView
      date={DATE}
      now={NOW}
      events={events}
      members={CROWD}
      settings={SETTINGS}
      onSelect={onSelect}
      {...PICKER_PROPS}
      roster={CROWD}
    />,
  );
}

describe("DayView overflow chip", () => {
  const crowd = [
    ev("a", "Standup", 9, 0, 10, 0),
    ev("b", "Sync", 9, 15, 10, 15),
    ev("c", "Test 3", 9, 30, 10, 30),
  ];

  it("renders one readable block plus a chip rather than three slivers", () => {
    renderCrowdedDay(crowd);
    const a = screen.getByRole("button", { name: /Standup/ });
    // 940/5 = 188px column, less the 34px chip lane, all of it to one block:
    // 154px, comfortably over the 96px floor three even columns would break.
    const COL_W = 940 / CROWD.length;
    expect(pct(a.style.width)).toBeCloseTo(((COL_W - 34) / COL_W) * 100, 2);
    expect((pct(a.style.width) / 100) * COL_W).toBeGreaterThanOrEqual(96);
    // The two that lost their column are not rendered as boxes at all.
    expect(screen.queryByRole("button", { name: /Sync/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Test 3/ })).toBeNull();
    expect(screen.getByRole("button", { name: /2 more events/ })).toBeTruthy();
  });

  it("labels a single hidden event in the singular", () => {
    renderCrowdedDay(crowd.slice(0, 2));
    expect(screen.getByRole("button", { name: /1 more event,/ })).toBeTruthy();
  });

  it("opens the whole slot, visible events included, when tapped", () => {
    renderCrowdedDay(crowd);
    fireEvent.click(screen.getByRole("button", { name: /2 more events/ }));
    const sheet = screen.getByRole("dialog");
    for (const title of ["Standup", "Sync", "Test 3"]) {
      expect(within(sheet).getByRole("button", { name: new RegExp(title) })).toBeTruthy();
    }
  });

  it("hands a tapped row to onSelect and closes, so the chip is not a dead end", () => {
    const onSelect = vi.fn();
    renderCrowdedDay(crowd, onSelect);
    fireEvent.click(screen.getByRole("button", { name: /2 more events/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Test 3/ }));
    expect(onSelect).toHaveBeenCalledWith(crowd[2]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives a chip a tappable height even when the slot is only 15 minutes long", () => {
    renderCrowdedDay([
      ev("a", "Quick", 9, 0, 9, 15),
      ev("b", "Also quick", 9, 0, 9, 15),
      ev("c", "Third", 9, 0, 9, 15),
    ]);
    const chip = screen.getByRole("button", { name: /2 more events/ });
    // 15 minutes at HOUR_H 34 is 8.5px; MORE_MIN_H floors it at 20.
    expect(Number.parseFloat(chip.style.height)).toBe(20);
  });

  it("splits one collision group into a chip per crowded run", () => {
    renderCrowdedDay([
      ev("a", "All morning", 9, 0, 12, 0),
      ev("b", "Early", 9, 30, 10, 0),
      ev("c", "Late", 11, 0, 11, 30),
    ]);
    expect(screen.getAllByRole("button", { name: /1 more event,/ })).toHaveLength(2);
  });
});

/*
  Multi-day all-day events used to render their chip only on `e.start`'s
  day — DATE (Mar 15 2026) is inside, not the start of, each trip below, so
  these would have shown nothing before the `spansDay` fix.
*/
/*
  Every member gets their own `.fb-dcol`, but they're all the same day, so
  the now-line used to be drawn once per column — a broken row of segments
  and dots instead of one line spanning the whole grid.
*/
describe("DayView now line", () => {
  const MULTI_MEMBERS = [
    { id: "brian", name: "Brian", color: "#7EB6E8" },
    { id: "jamie", name: "Jamie", color: "#E8A17E" },
  ];

  it("renders exactly one now-line across all member columns", () => {
    const { container } = render(
      <DayView
        date={DATE}
        now={NOW}
        events={[]}
        members={MULTI_MEMBERS}
        settings={SETTINGS}
        onSelect={() => {}}
        {...PICKER_PROPS}
      />,
    );
    expect(container.querySelectorAll(".fb-nowrow").length).toBe(1);
    expect(container.querySelectorAll(".fb-nowdot").length).toBe(1);
  });

  it("renders no now-line when the viewed day isn't today", () => {
    const otherDay = new Date(2026, 2, 16);
    const { container } = render(
      <DayView
        date={otherDay}
        now={NOW}
        events={[]}
        members={MULTI_MEMBERS}
        settings={SETTINGS}
        onSelect={() => {}}
        {...PICKER_PROPS}
      />,
    );
    expect(container.querySelectorAll(".fb-nowrow").length).toBe(0);
  });
});

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
