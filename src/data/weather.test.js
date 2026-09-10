import { describe, it, expect, beforeEach, vi } from "vitest";

import { fetchWeatherSnapshot, getWeather } from "./weather.js";
import { WEATHER_CONDITIONS } from "../contracts/schema.js";

/*
  PLAN.md §R6: item 1 (keyless provider), item 4 (the WeatherSnapshot shape),
  item 5 (cache aggressively, degrade quietly). These tests cover the mapping
  from a realistic Open-Meteo payload onto WeatherSnapshot, and the three
  states getWeather can resolve to: a live reading, a cached one after a
  failure, and null when neither exists.
*/

function openMeteoFixture(overrides = {}) {
  return {
    current: { temperature_2m: 71.4, weather_code: 2, ...overrides.current },
    hourly: {
      time: ["2026-09-09T13:00", "2026-09-09T14:00", "2026-09-09T15:00"],
      temperature_2m: [70, 74, 73],
      precipitation_probability: [10, 20, 15],
      uv_index: [3, 7, 4],
      ...overrides.hourly,
    },
    daily: {
      time: ["2026-09-09"],
      weather_code: [2],
      sunrise: ["2026-09-09T06:42"],
      sunset: ["2026-09-09T19:18"],
      temperature_2m_max: [76],
      temperature_2m_min: [58],
      ...overrides.daily,
    },
  };
}

/* A realistic multi-day payload — daily.time and hourly.time both span three
   days — for exercising the day-grouping the Month view's forecast relies
   on. Real Open-Meteo requests ask for sixteen; three is enough to prove the
   grouping without a wall of fixture data. */
function multiDayFixture() {
  return {
    current: { temperature_2m: 71.4, weather_code: 2 },
    hourly: {
      time: [
        "2026-09-09T13:00",
        "2026-09-09T14:00",
        "2026-09-10T09:00",
        "2026-09-10T15:00",
        "2026-09-11T12:00",
      ],
      temperature_2m: [70, 74, 55, 60, 80],
      precipitation_probability: [10, 20, 0, 5, 90],
      uv_index: [3, 7, 1, 2, 9],
    },
    daily: {
      time: ["2026-09-09", "2026-09-10", "2026-09-11"],
      weather_code: [2, 61, 3],
      sunrise: ["2026-09-09T06:42", "2026-09-10T06:43", "2026-09-11T06:44"],
      sunset: ["2026-09-09T19:18", "2026-09-10T19:16", "2026-09-11T19:14"],
      temperature_2m_max: [76, 65, 82],
      temperature_2m_min: [58, 52, 61],
    },
  };
}

function mockFetchOnce(json, { ok = true, status = 200 } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => json }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("fetchWeatherSnapshot", () => {
  it("maps an Open-Meteo payload onto the WeatherSnapshot shape", async () => {
    mockFetchOnce(openMeteoFixture());

    const snapshot = await fetchWeatherSnapshot({ lat: 33.749, lon: -84.388, units: "F" });

    expect(snapshot.temp).toBe(71.4);
    expect(snapshot.condition).toBe("partly");
    expect(WEATHER_CONDITIONS).toContain(snapshot.condition);
    expect(snapshot.hi).toBe(76);
    expect(snapshot.lo).toBe(58);
    expect(snapshot.sunrise).toBeInstanceOf(Date);
    expect(snapshot.sunset).toBeInstanceOf(Date);
    expect(snapshot.fetchedAt).toBeInstanceOf(Date);
    expect(snapshot.hourly).toHaveLength(3);
    expect(snapshot.hourly[1]).toEqual({
      at: new Date("2026-09-09T14:00"),
      temp: 74,
      precipChance: 20,
    });
    /* uv_index peaks at 7 in the 14:00 slot. */
    expect(snapshot.uvPeak).toEqual({ at: new Date("2026-09-09T14:00"), index: 7 });
  });

  it("folds an unmapped weather code to sunny, per spec", async () => {
    mockFetchOnce(openMeteoFixture({ current: { temperature_2m: 60, weather_code: 45 } }));
    const snapshot = await fetchWeatherSnapshot({ lat: 0, lon: 0, units: "F" });
    expect(snapshot.condition).toBe("sunny");
  });

  it("maps rain and snow codes distinctly", async () => {
    mockFetchOnce(openMeteoFixture({ current: { temperature_2m: 50, weather_code: 61 } }));
    expect((await fetchWeatherSnapshot({ lat: 0, lon: 0, units: "F" })).condition).toBe("rain");

    mockFetchOnce(openMeteoFixture({ current: { temperature_2m: 28, weather_code: 71 } }));
    expect((await fetchWeatherSnapshot({ lat: 0, lon: 0, units: "F" })).condition).toBe("snow");
  });

  it("throws on a non-ok response so getWeather is the only thing that degrades", async () => {
    mockFetchOnce({}, { ok: false, status: 500 });
    await expect(fetchWeatherSnapshot({ lat: 0, lon: 0, units: "F" })).rejects.toThrow();
  });

  it("groups the multi-day payload into one WeatherDay per daily.time entry", async () => {
    mockFetchOnce(multiDayFixture());
    const snapshot = await fetchWeatherSnapshot({ lat: 0, lon: 0, units: "F" });

    expect(snapshot.daily).toHaveLength(3);

    const [day0, day1, day2] = snapshot.daily;
    expect(day0.date).toEqual(new Date("2026-09-09T00:00"));
    expect(day0.hi).toBe(76);
    expect(day0.lo).toBe(58);
    expect(day0.condition).toBe("partly");
    expect(day0.hourly).toHaveLength(2);
    expect(day0.uvPeak).toEqual({ at: new Date("2026-09-09T14:00"), index: 7 });

    expect(day1.condition).toBe("rain");
    expect(day1.hourly).toHaveLength(2);
    expect(day1.uvPeak).toEqual({ at: new Date("2026-09-10T15:00"), index: 2 });

    expect(day2.condition).toBe("cloudy");
    expect(day2.hi).toBe(82);
    expect(day2.hourly).toHaveLength(1);
  });

  it("mirrors daily[0] in the top-level today fields, so Day/Week see no change", async () => {
    mockFetchOnce(multiDayFixture());
    const snapshot = await fetchWeatherSnapshot({ lat: 0, lon: 0, units: "F" });

    expect(snapshot.hi).toBe(snapshot.daily[0].hi);
    expect(snapshot.lo).toBe(snapshot.daily[0].lo);
    expect(snapshot.sunrise).toEqual(snapshot.daily[0].sunrise);
    expect(snapshot.sunset).toEqual(snapshot.daily[0].sunset);
    expect(snapshot.uvPeak).toEqual(snapshot.daily[0].uvPeak);
    expect(snapshot.hourly).toEqual(snapshot.daily[0].hourly);
  });
});

describe("getWeather", () => {
  it("resolves null when no location is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await getWeather({ label: "", lat: null, lon: null, units: "F" });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches a successful reading and serves it after a later failure", async () => {
    mockFetchOnce(openMeteoFixture());
    const first = await getWeather({ label: "Home", lat: 33.749, lon: -84.388, units: "F" });
    expect(first.location).toEqual({ label: "Home", lat: 33.749, lon: -84.388 });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const second = await getWeather({ label: "Home", lat: 33.749, lon: -84.388, units: "F" });
    expect(second).toEqual(first);
  });

  it("resolves null on failure when nothing has ever been cached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await getWeather({ label: "Home", lat: 33.749, lon: -84.388, units: "F" });
    expect(result).toBeNull();
  });
});
