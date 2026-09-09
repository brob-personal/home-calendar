import { useEffect, useState } from "react";

import { useBoard } from "../../state/BoardContext.js";
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
 * Reads settings.weather from BoardContext rather than a threaded prop —
 * CONTRACTS.md §6: "Read settings from useBoard() rather than threading a
 * prop." A location or unit change re-fetches immediately rather than waiting
 * out the poll interval.
 *
 * @returns {import("../../contracts/schema.js").WeatherSnapshot|null}
 */
export function useWeather() {
  const { settings } = useBoard();
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
