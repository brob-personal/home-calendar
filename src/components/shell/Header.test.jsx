import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { Header } from "./Header.jsx";

const NOW = new Date(2026, 8, 15, 9, 0);

function header(overrides = {}) {
  return (
    <Header
      now={NOW}
      anchor={overrides.anchor || NOW}
      events={[]}
      weather={null}
      degraded={false}
      onToday={() => {}}
      onSettings={() => {}}
      view="day"
      setView={() => {}}
      views={["day", "week", "month", "agenda"]}
      setAnchor={() => {}}
      roster={[]}
      isShown={() => true}
      onToggleMember={() => {}}
      filterTouched={false}
      onReset={() => {}}
      {...overrides}
    />
  );
}

function renderHeader(overrides = {}) {
  return render(header(overrides));
}

/*
  Item 3's fixed-width fix: all four readouts are <Roller>s, so the visible
  value is one .fb-roller-val and every possible value renders alongside it
  as a hidden .fb-roller-size — the block's width never depends on which one
  is showing. Covered here by asserting sizer counts rather than duplicate
  visible text.
*/
describe("Header", () => {
  it("shows the anchor's weekday, date and month/year", () => {
    const { container } = renderHeader({ anchor: new Date(2026, 8, 15) });
    expect(container.querySelector(".fb-dow .fb-roller-val")).toHaveTextContent("Tuesday");
    expect(container.querySelector(".fb-num .fb-roller-val")).toHaveTextContent("15");
    expect(container.querySelector(".fb-monthname .fb-roller-val")).toHaveTextContent("September");
    expect(container.querySelector(".fb-year .fb-roller-val")).toHaveTextContent("2026");
  });

  it("reserves width for every weekday and every month name, not just the active one", () => {
    const { container } = renderHeader({ anchor: new Date(2026, 8, 15) });
    expect(container.querySelectorAll(".fb-dow .fb-roller-size")).toHaveLength(7);
    expect(container.querySelectorAll(".fb-monthname .fb-roller-size")).toHaveLength(12);
    expect(container.querySelectorAll(".fb-year .fb-roller-size")).toHaveLength(1);
  });

  /*
    The month and year roll the same direction as the weekday/date beside
    them — all four read the one `dir` useAnchorDirection derives — so paging
    forward across a year boundary must roll every field upward, not just the
    two that used to animate.
  */
  it("rolls month and year in the same direction as the day when the anchor moves", () => {
    const { container, rerender } = renderHeader({ anchor: new Date(2026, 11, 31) });
    rerender(header({ anchor: new Date(2027, 0, 1) }));

    const rolling = (sel, text) =>
      [...container.querySelectorAll(`${sel} .fb-roller-val`)].find((v) => v.textContent === text);
    expect(rolling(".fb-monthname", "December")).toHaveClass("fb-roller-out-up");
    expect(rolling(".fb-monthname", "January")).toHaveClass("fb-roller-in-up");
    expect(rolling(".fb-year", "2026")).toHaveClass("fb-roller-out-up");
    expect(rolling(".fb-year", "2027")).toHaveClass("fb-roller-in-up");
  });
});
