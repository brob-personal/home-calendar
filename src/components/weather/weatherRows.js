/*
  Shared by WeatherWidget's expanded panel and MonthView's per-day breakdown
  sheet — both need "one time-ordered list of hours, sunrise, sunset and peak
  UV" for a day-shaped object (WeatherSnapshot's top-level fields for today,
  or one WeatherDay for any other day; both carry the same hourly/sunrise/
  sunset/uvPeak fields). Pulled out rather than duplicated so the two stay in
  sync automatically instead of by discipline.
*/

export function fmtTemp(v) {
  return Number.isFinite(v) ? `${Math.round(v)}°` : "--";
}

/*
  Filtered to the current hour onward: a future day's hours are all past
  `now`'s cutoff already, so this only ever trims anything when `day` is
  today — "what's coming", not "what already happened this morning".
*/
export function buildWeatherRows(day, now) {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const rows = [
    ...day.hourly.map((h) => ({
      type: "hour",
      at: h.at,
      temp: h.temp,
      precipChance: h.precipChance,
    })),
    { type: "sunrise", at: day.sunrise },
    { type: "sunset", at: day.sunset },
    ...(day.uvPeak ? [{ type: "uv", at: day.uvPeak.at, index: day.uvPeak.index }] : []),
  ];
  return rows
    .filter((r) => r.at instanceof Date && !Number.isNaN(r.at.getTime()) && r.at >= cutoff)
    .sort((a, b) => a.at - b.at);
}
