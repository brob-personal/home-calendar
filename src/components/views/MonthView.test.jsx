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
      <MonthView
        date={DATE}
        now={NOW}
        events={events}
        weather={null}
        onPick={() => {}}
        onSelect={onSelect}
        {...PICKER_PROPS}
      />
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
