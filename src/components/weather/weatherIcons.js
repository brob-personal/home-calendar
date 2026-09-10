import { Sunny, PartlyCloudy, Cloudy, Rain, Snow } from "./icons.jsx";

/*
  The condition-to-icon map, kept out of both ./icons.jsx (components-only,
  same reason ../shell/icons.jsx has no map of its own) and ./WeatherWidget.jsx
  (also components-only, now that MonthView needs this map too — a second
  component file exporting the same plain object would trip
  react-refresh/only-export-components right back).
*/
export const WEATHER_ICONS = {
  sunny: Sunny,
  partly: PartlyCloudy,
  cloudy: Cloudy,
  rain: Rain,
  snow: Snow,
};
