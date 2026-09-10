import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { Header } from "./Header.jsx";

const NOW = new Date(2026, 8, 15, 9, 0);

function renderHeader(overrides = {}) {
  return render(
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
    />,
  );
}

/*
  Item 3's fixed-width fix: the currently-active weekday/date/month is the
  only visible copy, but every possible value renders alongside it (hidden)
  so the block's width never depends on which one is showing. Covered here
  by asserting sizer/is-active counts rather than duplicate visible text.
*/
describe("Header", () => {
  it("shows the anchor's weekday, date and month/year", () => {
    const { container } = renderHeader({ anchor: new Date(2026, 8, 15) });
    expect(container.querySelector(".fb-dow .fb-roller-val")).toHaveTextContent("Tuesday");
    expect(container.querySelector(".fb-num .fb-roller-val")).toHaveTextContent("15");
    expect(container.querySelector(".fb-monthname .is-active")).toHaveTextContent("September");
    expect(container.querySelector(".fb-month")).toHaveTextContent("2026");
  });

  it("reserves width for every weekday and every month name, not just the active one", () => {
    const { container } = renderHeader({ anchor: new Date(2026, 8, 15) });
    expect(container.querySelectorAll(".fb-dow .fb-roller-size")).toHaveLength(7);
    expect(container.querySelectorAll(".fb-monthname > span")).toHaveLength(12);
  });
});
