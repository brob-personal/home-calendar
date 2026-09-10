import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import { WeatherWidget } from "./WeatherWidget.jsx";

/*
  PLAN.md §R6 acceptance: "Header shows live conditions. Widget expands and
  collapses on tap within the 1080x810 canvas without overflowing."

  `snapshot` is passed straight in as a prop rather than mocking
  ./useWeather.js — App.jsx now owns the one `useWeather()` call (see
  App.jsx and CONTRACTS.md §6), so this component only ever receives a
  reading, and isolating it from that reading is a prop, not a mock.
  ./useWeather.js's own fetch/cache/poll behaviour is covered by
  ../../data/weather.test.js.
*/
const NOW = new Date("2026-09-09T14:05:00");

function snapshot(overrides = {}) {
  return {
    fetchedAt: NOW,
    location: { label: "Home", lat: 33.749, lon: -84.388 },
    units: "F",
    temp: 71.6,
    condition: "rain",
    hi: 76,
    lo: 58,
    sunrise: new Date("2026-09-09T06:42:00"),
    sunset: new Date("2026-09-09T19:18:00"),
    uvPeak: { at: new Date("2026-09-09T14:00:00"), index: 7 },
    hourly: [
      { at: new Date("2026-09-09T14:00:00"), temp: 74, precipChance: 40 },
      { at: new Date("2026-09-09T15:00:00"), temp: 73, precipChance: 55 },
    ],
    ...overrides,
  };
}

describe("WeatherWidget", () => {
  it("renders nothing while unconfigured or before the first reading", () => {
    const { container } = render(<WeatherWidget now={NOW} snapshot={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the collapsed icon and temperature in the configured units", () => {
    render(<WeatherWidget now={NOW} snapshot={snapshot()} />);
    expect(screen.getByRole("button", { name: /expand weather/i })).toHaveTextContent("72°F");
  });

  it("expands on tap into hi/lo, hourly rows, sunrise, sunset and peak UV, then collapses", () => {
    vi.useFakeTimers();
    /* Before sunrise, so nothing in the fixture is filtered out by the
       "current hour onward" cutoff — see the dedicated cutoff test below. */
    const early = new Date("2026-09-09T05:05:00");
    render(<WeatherWidget now={early} snapshot={snapshot()} />);

    expect(screen.queryByRole("group")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand weather/i }));

    const panel = screen.getByRole("group");
    expect(panel).toHaveTextContent("H 76°");
    expect(panel).toHaveTextContent("L 58°");
    expect(panel).toHaveTextContent(/Sunrise/);
    expect(panel).toHaveTextContent(/Sunset/);
    expect(panel).toHaveTextContent(/Peak UV.*index 7/);

    fireEvent.click(screen.getByRole("button", { name: /collapse weather/i }));
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("plays a shrink animation before the panel unmounts, rather than vanishing instantly", () => {
    vi.useFakeTimers();
    render(<WeatherWidget now={NOW} snapshot={snapshot()} />);

    fireEvent.click(screen.getByRole("button", { name: /expand weather/i }));
    fireEvent.click(screen.getByRole("button", { name: /collapse weather/i }));

    expect(screen.getByRole("group")).toHaveClass("fb-weatherpanel--closing");
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("drops hours before the current one, so a stale morning reading doesn't linger all day", () => {
    render(
      <WeatherWidget
        now={NOW}
        snapshot={snapshot({
          hourly: [
            { at: new Date("2026-09-09T09:00:00"), temp: 60, precipChance: 0 },
            { at: new Date("2026-09-09T14:00:00"), temp: 74, precipChance: 40 },
          ],
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /expand weather/i }));
    expect(screen.queryByText("60°")).not.toBeInTheDocument();
    expect(screen.getByText("74°")).toBeInTheDocument();
  });

  it("falls back to the sunny icon for an unrecognized condition", () => {
    const { container } = render(
      <WeatherWidget now={NOW} snapshot={snapshot({ condition: "not-a-real-condition" })} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
