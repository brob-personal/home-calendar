import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { MonthView } from "./MonthView.jsx";
import { PaletteContext } from "../../state/PaletteContext.js";

/*
  The forecast toggle and per-day breakdown added alongside the 16-day
  fetch (src/data/weather.js) — see MonthView.jsx's own header comment.
  Event rendering and the six-vs-five-row `cut` logic already have no
  dedicated coverage elsewhere; this file only exercises what's new.
*/
const DATE = new Date(2026, 8, 1); // September 2026
const NOW = new Date(2026, 8, 9, 14, 0);

const palette = { fillFor: () => "#fff", firstColor: () => "#fff", byId: {}, palette: {} };

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
    fetchedAt: NOW,
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

function renderMonth(props = {}) {
  const onPick = vi.fn();
  const onSelect = vi.fn();
  render(
    <PaletteContext.Provider value={palette}>
      <MonthView
        date={DATE}
        now={NOW}
        events={[]}
        weather={null}
        onPick={onPick}
        onSelect={onSelect}
        {...props}
      />
    </PaletteContext.Provider>,
  );
  return { onPick, onSelect };
}

describe("MonthView forecast", () => {
  it("shows no weather toggle and no H/L text when weather is unconfigured", () => {
    renderMonth();
    expect(screen.queryByRole("button", { name: /show forecast/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/H76°/)).not.toBeInTheDocument();
  });

  it("reveals each day's H/L only after the toggle is tapped", () => {
    renderMonth({ weather: weatherSnapshot() });
    expect(screen.queryByText("H76° L58°")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show forecast/i }));
    expect(screen.getByText("H76° L58°")).toBeInTheDocument();
    expect(screen.getByText("H82° L61°")).toBeInTheDocument();
  });

  it("opens that day's breakdown on H/L tap, without triggering the cell's onPick", () => {
    const { onPick } = renderMonth({ weather: weatherSnapshot() });
    fireEvent.click(screen.getByRole("button", { name: /show forecast/i }));

    fireEvent.click(screen.getByText("H76° L58°"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Wed, Sep 9");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("still navigates via onPick when the day number itself is tapped", () => {
    const { onPick } = renderMonth({ weather: weatherSnapshot() });
    fireEvent.click(screen.getByRole("button", { name: /show forecast/i }));

    const cell = screen.getByText("H76° L58°").closest(".fb-cell");
    fireEvent.click(cell.querySelector(".fb-cellnum"));
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
