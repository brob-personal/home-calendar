import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { MonthView } from "./MonthView.jsx";
import { PaletteContext } from "../../state/PaletteContext.js";

const palette = { fillFor: () => "#fff", firstColor: () => "#fff", byId: {}, palette: {} };

/*
  The forecast toggle and per-day breakdown added alongside the 16-day
  fetch (src/data/weather.js) — see MonthView.jsx's own header comment.
  Event rendering and the six-vs-five-row `cut` logic already have no
  dedicated coverage elsewhere; this file only exercises what's new.
*/
const FORECAST_DATE = new Date(2026, 8, 1); // September 2026
const FORECAST_NOW = new Date(2026, 8, 9, 14, 0);

function weatherDay(dateStr, hi, lo) {
  return {
    date: new Date(`${dateStr}T00:00`),
    condition: "sunny",
    hi,
    lo,
    sunrise: new Date(`${dateStr}T06:42`),
    sunset: new Date(`${dateStr}T19:18`),
    uvPeak: null,
    hourly: [],
  };
}

function weatherSnapshot() {
  return {
    fetchedAt: FORECAST_NOW,
    location: { label: "Home", lat: 0, lon: 0 },
    units: "F",
    temp: 70,
    condition: "sunny",
    hi: 76,
    lo: 58,
    sunrise: new Date("2026-09-09T06:42"),
    sunset: new Date("2026-09-09T19:18"),
    uvPeak: null,
    hourly: [],
    daily: [weatherDay("2026-09-09", 76, 58), weatherDay("2026-09-15", 82, 61)],
  };
}

const PICKER_PROPS = {
  roster: [],
  isShown: () => true,
  onToggleMember: () => {},
  filterTouched: false,
  onReset: () => {},
};

function renderForecastMonth(props = {}) {
  const onPick = vi.fn();
  const onSelect = vi.fn();
  render(
    <PaletteContext.Provider value={palette}>
      <MonthView
        date={FORECAST_DATE}
        now={FORECAST_NOW}
        events={[]}
        weather={null}
        onPick={onPick}
        onSelect={onSelect}
        {...PICKER_PROPS}
        {...props}
      />
    </PaletteContext.Provider>,
  );
  return { onPick, onSelect };
}

describe("MonthView forecast", () => {
  it("shows no weather toggle and no H/L text when weather is unconfigured", () => {
    renderForecastMonth();
    expect(screen.queryByRole("button", { name: /show forecast/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/H76°/)).not.toBeInTheDocument();
  });

  it("reveals each day's H/L only after the toggle is tapped", () => {
    renderForecastMonth({ weather: weatherSnapshot() });
    expect(screen.queryByText("H76° L58°")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show forecast/i }));
    expect(screen.getByText("H76° L58°")).toBeInTheDocument();
    expect(screen.getByText("H82° L61°")).toBeInTheDocument();
  });

  it("opens that day's breakdown on H/L tap, without triggering the cell's onPick", () => {
    const { onPick } = renderForecastMonth({ weather: weatherSnapshot() });
    fireEvent.click(screen.getByRole("button", { name: /show forecast/i }));

    fireEvent.click(screen.getByText("H76° L58°"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Wed, Sep 9");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("still navigates via onPick when the day number itself is tapped", () => {
    const { onPick } = renderForecastMonth({ weather: weatherSnapshot() });
    fireEvent.click(screen.getByRole("button", { name: /show forecast/i }));

    const cell = screen.getByText("H76° L58°").closest(".fb-cell");
    fireEvent.click(cell.querySelector(".fb-cellnum"));
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});

const DATE = new Date(2026, 2, 15); // March 2026
const NOW = DATE;

function allDayEv(id, title, startDate, endDate) {
  return {
    id,
    title,
    start: startDate,
    end: endDate,
    allDay: true,
    memberIds: ["brian"],
    variant: 0,
  };
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

function renderMonth(events, onSelect = () => {}, onPick = () => {}) {
  return render(
    <PaletteContext.Provider value={palette}>
      <MonthView
        date={DATE}
        now={NOW}
        events={events}
        weather={null}
        onPick={onPick}
        onSelect={onSelect}
        {...PICKER_PROPS}
      />
    </PaletteContext.Provider>,
  );
}

/*
  MonthView used to filter every cell independently and stack its own chips,
  so a multi-day event drew an identical chip in each cell it touched with
  nothing linking them. It now draws one bar spanning those days, clipped at
  each week boundary — March 2026's grid starts Sun Mar 1, so a Thu Mar 12 -
  Sun Mar 15 trip crosses from the Mar 8 week into the Mar 15 one and is two
  bars, one per row, not one per day.

  Bars carry their placement in a calc() percentage of the row; `cols` reads
  the column count back out of it.
*/
function cols(expr) {
  const m = expr.match(/calc\(([\d.]+)%/);
  return m ? Math.round((Number(m[1]) / 100) * 7) : null;
}

describe("MonthView multi-day bars", () => {
  it("draws one bar per week row, not one chip per day", () => {
    renderMonth([allDayEv("t", "Kauai", new Date(2026, 2, 12), new Date(2026, 2, 15))]);
    const bars = screen.getAllByText("Kauai");
    expect(bars).toHaveLength(2);

    // Thu Mar 12 - Sat Mar 14 in the first row: column 4, three wide.
    expect(cols(bars[0].style.left)).toBe(4);
    expect(cols(bars[0].style.width)).toBe(3);
    // Sun Mar 15 alone in the next row.
    expect(cols(bars[1].style.left)).toBe(0);
    expect(cols(bars[1].style.width)).toBe(1);
  });

  it("squares the edges where a bar carries over a week boundary", () => {
    renderMonth([allDayEv("t", "Kauai", new Date(2026, 2, 12), new Date(2026, 2, 15))]);
    const [first, second] = screen.getAllByText("Kauai");
    expect(first.className).toContain("is-cont-after");
    expect(first.className).not.toContain("is-cont-before");
    expect(second.className).toContain("is-cont-before");
    expect(second.className).not.toContain("is-cont-after");
  });

  it("draws a single-day all-day event as one bar in its own column", () => {
    renderMonth([allDayEv("h", "Holiday", new Date(2026, 2, 17), new Date(2026, 2, 17))]);
    const bar = screen.getByText("Holiday");
    expect(cols(bar.style.left)).toBe(2); // Tuesday
    expect(cols(bar.style.width)).toBe(1);
  });

  it("still shows a timed event only on its own day", () => {
    renderMonth([timedEv("s", "Standup", 12, 9, 10)]);
    const bars = screen.getAllByText("Standup");
    expect(bars).toHaveLength(1);
    expect(cols(bars[0].style.width)).toBe(1);
  });

  it("opens the detail sheet when a bar is tapped", () => {
    const onSelect = vi.fn();
    const trip = allDayEv("t", "Kauai", new Date(2026, 2, 12), new Date(2026, 2, 15));
    renderMonth([trip], onSelect);
    // Tap the continuation bar in the second row, not the trip's start day.
    screen.getAllByText("Kauai")[1].click();
    expect(onSelect).toHaveBeenCalledWith(trip);
  });

  it("does not fire the cell's onPick when a bar is tapped", () => {
    const onPick = vi.fn();
    const holiday = allDayEv("h", "Holiday", new Date(2026, 2, 17), new Date(2026, 2, 17));
    renderMonth([holiday], () => {}, onPick);
    fireEvent.click(screen.getByText("Holiday"));
    expect(onPick).not.toHaveBeenCalled();
  });

  it("stacks two events sharing a day into different lanes", () => {
    renderMonth([
      allDayEv("a", "Trip", new Date(2026, 2, 16), new Date(2026, 2, 18)),
      allDayEv("b", "Visitors", new Date(2026, 2, 17), new Date(2026, 2, 19)),
    ]);
    expect(screen.getByText("Trip").style.top).toBe("0px");
    expect(Number(screen.getByText("Visitors").style.top.replace("px", ""))).toBeGreaterThan(0);
  });

  it("collapses a day's overflow into a '+N more' that navigates to that day", () => {
    const onPick = vi.fn();
    // Five events on one day against the three-lane fallback: two bars draw,
    // the third lane becomes the count.
    const events = ["a", "b", "c", "d", "e"].map((id) =>
      allDayEv(id, `Ev ${id}`, new Date(2026, 2, 17), new Date(2026, 2, 17)),
    );
    renderMonth(events, () => {}, onPick);
    const more = screen.getByRole("button", { name: "3 more" });
    expect(cols(more.style.left)).toBe(2);

    fireEvent.click(more);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].getDate()).toBe(17);
  });
});
