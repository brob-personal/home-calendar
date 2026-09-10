import { useEffect, useState } from "react";

import { getWeather } from "../../data/weather.js";

/*
  R6 backlog item 5's polling cadence. Weather does not need a 20-second tick
  like useNow (../../hooks/useNow.js) — Open-Meteo's own model updates on the
  order of an hour — so this hook keeps its own timer rather than riding
  App's clock.
*/
const POLL_MS = 15 * 60 * 1000;

/**
 * The board's current weather reading, or null while unconfigured (no
 * lat/lon in settings) or before the first fetch has resolved.
 *
 * Takes `settings` as a direct argument rather than reading BoardContext
 * (CONTRACTS.md §6's original "read settings from useBoard()" is superseded
 * by this) — App.jsx now makes the one call for the whole board and hands
 * the reading to both Header and MonthView, the same reason
 * `useBoardPalette`/`useModeState` take `settings` explicitly: App cannot
 * consume the context it is itself about to provide. A location or unit
 * change re-fetches immediately rather than waiting out the poll interval.
 *
 * @param {import("../../contracts/schema.js").Settings} settings
 * @returns {import("../../contracts/schema.js").WeatherSnapshot|null}
 */
export function useWeather(settings) {
  const { label, lat, lon, units } = settings.weather;
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (lat == null || lon == null) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      getWeather({ label, lat, lon, units }).then((next) => {
        if (!cancelled && next) setSnapshot(next);
      });
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [label, lat, lon, units]);

  return snapshot;
}
