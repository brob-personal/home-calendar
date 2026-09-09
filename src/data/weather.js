/*
  ============================================================================
  WEATHER — R6, backlog items 1 and 5
  ----------------------------------------------------------------------------
  "Pick a keyless provider (Open-Meteo or equivalent) so this role is not
  blocked on R4 and the board needs no additional secret." / "Cache
  aggressively and degrade quietly — a wall board with a dead network should
  show stale weather, not an error."

  Open-Meteo needs no API key, so this role never touches R4's server side and
  the board needs no additional credential to show weather.

  Two functions, split for the same reason the calendar source seam is split
  in ../contracts/source.js: `fetchWeatherSnapshot` is a pure network-to-shape
  mapping a test can call directly, and `getWeather` is the only thing that
  knows about the cache. On success it writes the reading to storage and
  returns it; on failure — dead network, DNS, a 500, a timeout — it reads the
  last cached reading back instead of throwing, which is item 5's "degrade
  quietly". A board that has never once had a network resolves null rather
  than inventing a reading, which is what tells WeatherWidget to render
  nothing instead of a stale lie.
  ============================================================================
*/
import { normalizeCondition } from "../contracts/schema.js";
import { store } from "../lib/store.js";

const CACHE_KEY = "weatherCache";
const API_BASE = "https://api.open-meteo.com/v1/forecast";
const FETCH_TIMEOUT_MS = 8000;

/*
  WMO weather codes (open-meteo.com/en/docs, "WMO Weather interpretation
  codes") folded into the five icons PLAN.md §R6 item 2 allows. Only codes
  that clearly read as "partly cloudy", "overcast", "rain" or "snow" get their
  own bucket. Everything else — fog, a code this table has never seen — falls
  through to the default, which normalizeCondition() also enforces: "every
  other condition maps to Sunny" is the spec, not a shortcut.
*/
function conditionFromCode(code) {
  switch (code) {
    case 2:
      return "partly";
    case 3:
      return "cloudy";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
    case 95:
    case 96:
    case 99:
      return "rain";
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return "snow";
    default:
      return "sunny";
  }
}

/* The hourly row with the highest UV index, and its hour — "peak UV time
   with its index" per backlog item 4. A tie keeps the earliest hour. */
function pickUvPeak(hours) {
  if (!hours.length) return null;
  let peak = hours[0];
  for (const h of hours) {
    if (h.uv > peak.uv) peak = h;
  }
  return { at: peak.at, index: peak.uv };
}

/**
 * Fetch one live reading from Open-Meteo and map it onto WeatherSnapshot
 * (../contracts/schema.js). Throws on any network, HTTP or timeout failure —
 * getWeather is what degrades, this stays a straight mapping.
 *
 * `forecast_days=1` plus `timezone=auto` returns the day's hours, sunrise and
 * sunset in the location's own local time as bare "YYYY-MM-DDTHH:MM" strings,
 * which `new Date(...)` reads as browser-local. That is only correct when the
 * board's timezone matches the configured location's — true for this board,
 * which sits at the location it displays weather for, but worth knowing
 * before reusing this function somewhere that assumption does not hold.
 *
 * @param {{lat: number, lon: number, units: "F"|"C"}} location
 * @returns {Promise<import("../contracts/schema.js").WeatherSnapshot>}
 */
export async function fetchWeatherSnapshot({ lat, lon, units }) {
  const url =
    `${API_BASE}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code` +
    `&hourly=temperature_2m,precipitation_probability,uv_index` +
    `&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=${units === "C" ? "celsius" : "fahrenheit"}` +
    `&timezone=auto&forecast_days=1`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
  const json = await res.json();

  const times = json.hourly?.time ?? [];
  const hours = times.map((t, i) => ({
    at: new Date(t),
    temp: json.hourly.temperature_2m?.[i] ?? null,
    precipChance: json.hourly.precipitation_probability?.[i] ?? 0,
    uv: json.hourly.uv_index?.[i] ?? 0,
  }));

  return {
    fetchedAt: new Date(),
    location: { label: "", lat, lon },
    units,
    temp: json.current?.temperature_2m ?? null,
    condition: normalizeCondition(conditionFromCode(json.current?.weather_code)),
    hi: json.daily?.temperature_2m_max?.[0] ?? null,
    lo: json.daily?.temperature_2m_min?.[0] ?? null,
    sunrise: new Date(json.daily?.sunrise?.[0]),
    sunset: new Date(json.daily?.sunset?.[0]),
    uvPeak: pickUvPeak(hours),
    hourly: hours.map(({ at, temp, precipChance }) => ({ at, temp, precipChance })),
  };
}

/**
 * The cached, degrading read that WeatherWidget actually calls.
 *
 * `lat`/`lon` null means "not configured yet" (../contracts/defaults.js) —
 * resolves null rather than requesting a coordinate that does not exist. A
 * successful fetch is cached and returned; a failed one falls back to
 * whatever was last cached, which is `null` if there has never been one. A
 * cache write failure (storage full, unavailable) must not turn a perfectly
 * good reading into a thrown error — the board still has the value in hand
 * this tick, it just will not survive reload.
 *
 * @param {{label: string, lat: number|null, lon: number|null, units: "F"|"C"}} location
 * @returns {Promise<import("../contracts/schema.js").WeatherSnapshot|null>}
 */
export async function getWeather({ label, lat, lon, units }) {
  if (lat == null || lon == null) return null;
  try {
    const snapshot = await fetchWeatherSnapshot({ lat, lon, units });
    snapshot.location.label = label;
    try {
      await store.set(CACHE_KEY, snapshot);
    } catch {
      /* Swallowed deliberately — see the doc comment above. */
    }
    return snapshot;
  } catch {
    try {
      return (await store.get(CACHE_KEY)) ?? null;
    } catch {
      return null;
    }
  }
}
