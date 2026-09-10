# R6 — Weather Engineer

What landed and why, the way `CONTRACTS.md` is R3's note and `REFACTOR-NOTES.md`
is R2's.

**The one-line summary.** Open-Meteo (keyless) feeds a header chip and an
expandable widget; a failed fetch falls back to the last cached reading rather
than an error.

---

## 1. The files

| File | What it is |
|---|---|
| `src/data/weather.js` | `fetchWeatherSnapshot()` — the Open-Meteo call and its mapping onto `WeatherSnapshot`. `getWeather()` — the cached, degrading read everything else calls. |
| `src/components/weather/icons.jsx` | The five condition icons, components only — see §3. |
| `src/components/weather/useWeather.js` | Polls `getWeather()` every 15 minutes, reading location/units from `useBoard().settings.weather`. |
| `src/components/weather/WeatherStyles.jsx` | This feature's stylesheet — see §3 for why it isn't in `src/styles/**`. |
| `src/components/weather/WeatherWidget.jsx` | The chip + expandable panel. Owns the icon map (§3) and the merged time-ordered row list (§4). |

Tests: `src/data/weather.test.js` (condition mapping, snapshot shape, the
cache/degrade states), `src/components/weather/WeatherWidget.test.jsx` (icon
selection, expand/collapse, the "current hour onward" cutoff).

---

## 2. Provider and mapping

Open-Meteo, one request per fetch:

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=...&longitude=...
  &current=temperature_2m,weather_code
  &hourly=temperature_2m,precipitation_probability,uv_index
  &daily=sunrise,sunset,temperature_2m_max,temperature_2m_min
  &temperature_unit=fahrenheit|celsius&timezone=auto&forecast_days=1
```

No key, so this role never touched R4's server side and the board needs no
additional secret — backlog item 1.

WMO weather codes fold to the five conditions `WEATHER_CONDITIONS` closes on
(`src/contracts/schema.js`): code 2 → `partly`, code 3 → `cloudy`, the
drizzle/rain/shower/thunderstorm codes → `rain`, the snow/snow-shower codes →
`snow`. Everything else — fog, an unrecognized code — falls through to
`normalizeCondition()`'s default, which is `sunny` by spec (backlog item 2),
not a shortcut.

`timezone=auto` returns hours, sunrise and sunset as bare local-time strings,
which `new Date(...)` reads as browser-local. Correct because the board sits
at the location it displays weather for; would not be if this function were
ever reused somewhere that assumption doesn't hold. Noted in the doc comment
on `fetchWeatherSnapshot`.

---

## 3. Two ownership decisions worth a reviewer's attention

**Weather's stylesheet is not in `src/styles/**`.** PLAN.md §2 marks that path
R5's exclusive one, and `src/styles/styles.contract.test.js` asserts `BOARD_CSS`
is byte-identical to the original prototype string — a fixture with no weather
feature in it, so adding a chunk there would fail that test for a reason
unrelated to what it guards. R5's wave also ran before this feature existed,
so there is no tokens.css yet to fold into. `WeatherStyles.jsx` follows
`BoardStyles.jsx`'s own pattern instead — a memoized module-constant `<style>`
tag — and stays entirely inside `src/components/weather/`, this role's
exclusive path, so it needed no PLAN.md-routed contract change to land (§5
rule 2). It reads the same `--surface` / `--paper` / `--ink` / `--mute`
custom properties every other component does; nothing new is invented.

**The condition→icon map lives in `WeatherWidget.jsx`, not `icons.jsx`.**
`icons.jsx` exports five components and nothing else, matching
`../shell/icons.jsx`'s shape exactly. A sixth export — the map — trips
`react-refresh/only-export-components`; keeping the file components-only was
cheaper than carrying a lint warning.

Two files outside this role's owned paths were touched, both pre-authorized
by comments already in place before this role started:

- `src/components/shell/Header.jsx` — one import and one line,
  `<WeatherWidget now={now} />`, where the file's own comment named this as
  "destined for this header."
- `src/components/settings/Settings.jsx` — one `Field` block (location label,
  latitude, longitude, °F/°C), where the file's own comment named "R6 the
  weather location" as one of three sections later roles would add.

---

## 4. The expanded panel is one merged, time-ordered list

Backlog item 4 asks for "hourly temperature, hourly precipitation chance,
sunrise and sunset in the same list, and peak UV time with its index" — read
literally as one list with those rows interleaved at their actual hour, not
four separate sections. `WeatherWidget`'s `buildRows()` does exactly that:
hourly rows plus a sunrise row, a sunset row and a peak-UV row, sorted by
time and filtered to the current hour onward. "Onward" because
`forecast_days=1` returns the whole local day, and a wall board answers
"what's coming", not "what already happened this morning" — which is also why
a `now` before sunrise is needed to see the sunrise row in a test; past noon,
today's sunrise is correctly gone from the list.

The panel is `position: absolute`, anchored to `.fb-weather`
(`position: relative`) — the wrapper around the chip that opens it. It used
to be `position: fixed` with a hardcoded top/right offset, relying on
`.fb-device` (`src/styles/fit.js`) carrying a CSS transform — the `<Fit>`
scaler — to make it the containing block for that fixed box, pinning it
inside the 1080×810 canvas regardless of the real viewport. That kept it
"without overflowing" per backlog item 4, but only because the chip itself
always sat in that one corner; once the chip moved elsewhere in the header,
the panel kept opening at the old fixed spot instead of near the chip.
Anchoring to `.fb-weather` ties the panel to wherever the chip actually
renders, and it still can't overflow the canvas in practice since the chip
itself never sits close enough to an edge for the 300px panel to run off it.

---

## 5. Cache and degrade

`getWeather()` is the only thing that knows about the cache. A successful
fetch is written to `localStorage` under `weatherCache` (via `src/lib/store.js`,
so Dates survive through `src/contracts/serialize.js` the same as every other
persisted slice) and returned. A failed fetch reads that value back instead of
throwing. Never configured (`lat`/`lon` null, the default in
`src/contracts/defaults.js`) resolves `null` without attempting a request —
the widget renders nothing rather than guessing a location, which is also
true before the very first fetch has ever succeeded once.

One limitation, accepted rather than solved: a cached reading carries whatever
location/units were active when it was fetched. Changing either in Settings
while offline shows the old reading under the old label until the next
successful fetch. Not worth a version-keyed cache for a value that refreshes
every 15 minutes the moment the network returns.

---

## 6. What I did not build

No geolocation "use my location" button in Settings — manual latitude and
longitude fully satisfy backlog item 6 ("Location configurable in Settings"),
and `navigator.geolocation` adds a permissions prompt and an HTTPS
requirement for one input a person sets once. No dedicated "weather failed"
error state — item 5 explicitly asks for the opposite: show the stale reading
quietly, which is what happens, with a small "Updated H:MMx — offline" line
in the panel once a reading is more than 45 minutes old.

---

## 7. Left for the next reviewer

`src/styles/styles.contract.test.js` fails on a stock checkout of this
worktree, unrelated to anything above: this machine has `core.autocrlf=true`,
which normalizes the fixture (loaded via Vite's `?raw`, which bypasses the JS
transform) to CRLF on checkout while `BOARD_CSS` — built from parsed and
re-emitted template literals — comes out LF. Reproduces identically with zero
changes to this branch; not touched here, since `src/styles/**` is R5's path
and the file names R5 as its sole authorized editor.
