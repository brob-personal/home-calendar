# Event Form Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the add/edit-event sheet to mirror Google Calendar — title-first,
a single robust date/time control instead of separate day/starts/for pill rows,
no scrollbars anywhere except inside the time picker — plus its two
prerequisites: an app-wide 12h/24h time-format setting and a `description`
field on events.

**Architecture:** Two independent additions land first (time-format setting
threaded through every display component; a `description` field threaded
through the schema and the Google adapter), each with its own tests. Then a
new pure `lib/time.js` (parsing/duration helpers) and two new self-contained
field components (`DateField`, `TimeField`) are built and unit-tested in
isolation. Finally a shared `EventForm.jsx` composes all of the above into the
full field layout with a small, directly-tested multi-day state machine, and
`Composer.jsx`/`EventDetailSheet.jsx` become thin wrappers around it.

**Tech Stack:** React (plain JSX, no UI framework), hand-rolled CSS-in-JS
template strings (`src/styles/**.js`), Vitest + `@testing-library/react` +
`@testing-library/user-event`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-event-form-redesign-design.md`

## Global Constraints

- No new npm dependencies — no date library, no UI kit. Everything here is
  hand-rolled, matching every existing file in `src/lib` and `src/components`.
- Icons are inline SVG in the existing house style: `viewBox="0 0 24 24"`,
  `fill="none"`, `stroke="currentColor"`, `strokeWidth` 1.7–1.8 (see
  `src/components/shell/icons.jsx`).
- Popovers reuse the existing shared dropdown primitives —
  `.fb-headdd` / `.fb-ddscrim` / `.fb-ddpop` / `.fb-ddopt`, defined once in
  `src/styles/shell/HeaderControls.js` and already used by `MemberPicker.jsx`
  and `ViewSwitcher.jsx`. Do not invent a second popover mechanism.
- `fmtTime(date, format = "12")`, `fmtClock(date, format = "12")`, and
  `fmtRange(start, end, format = "12")` all default their format parameter to
  `"12"` — every existing call site and test that doesn't pass a format keeps
  rendering exactly what it renders today.
- Run `npm test` (== `vitest run`) after every task; all tests must pass
  before moving to the next task.

---

### Task 1: `timeFormat` setting — schema, defaults, migration

**Files:**
- Modify: `src/contracts/schema.js` (Settings typedef, ~line 419-436)
- Modify: `src/contracts/defaults.js` (`DEFAULT_SETTINGS`, ~line 85-123)
- Modify: `src/contracts/migrate.js` (`migrateSettings`, ~line 184-223)
- Test: `src/contracts/migrate.test.js`

**Interfaces:**
- Produces: `Settings.timeFormat: "12" | "24"`, readable by every later task
  as `settings.timeFormat`.

- [ ] **Step 1: Write the failing migration test**

Add to `src/contracts/migrate.test.js`, in the existing `describe("migrate — a
version 0 board"...)` area is fine, or a new describe block near the other
per-field validation tests (the `sleepStyle: "sepia"` one at line 175):

```js
describe("migrateSettings — timeFormat", () => {
  it("defaults to 12-hour when absent", () => {
    expect(migrateSettings({}).timeFormat).toBe("12");
  });

  it("keeps an explicit 24-hour choice", () => {
    expect(migrateSettings({ timeFormat: "24" }).timeFormat).toBe("24");
  });

  it("falls back to 12-hour for a garbage value", () => {
    expect(migrateSettings({ timeFormat: "banana" }).timeFormat).toBe("12");
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npm test -- migrate.test.js`
Expected: FAIL — `timeFormat` is `undefined`, not `"12"`.

- [ ] **Step 3: Add the field to the schema typedef**

In `src/contracts/schema.js`, inside the `Settings` typedef JSDoc block
(right after the `@property {"personal"|"roommate"} mode` line), add:

```js
 * @property {"12"|"24"} timeFormat  12-hour ("8:00 PM") or 24-hour ("20:00") display.
```

- [ ] **Step 4: Add the default**

In `src/contracts/defaults.js`, inside `DEFAULT_SETTINGS`, add (near `mode:
"personal",`):

```js
  /** @type {"12"|"24"} */
  timeFormat: "12",
```

- [ ] **Step 5: Validate it in migrateSettings**

In `src/contracts/migrate.js`, inside `migrateSettings`'s returned object, add
a line next to the `mode` validation:

```js
    mode: MODES.includes(s.mode) ? s.mode : DEFAULT_SETTINGS.mode,
    timeFormat: s.timeFormat === "24" ? "24" : DEFAULT_SETTINGS.timeFormat,
```

- [ ] **Step 6: Run tests, confirm they pass**

Run: `npm test -- migrate.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/contracts/schema.js src/contracts/defaults.js src/contracts/migrate.js src/contracts/migrate.test.js
git commit -m "Add settings.timeFormat (12h/24h), defaulted and migrated"
```

---

### Task 2: Format-aware `fmtTime`/`fmtClock`/`fmtRange`, plus `fmtFullDate`

**Files:**
- Modify: `src/lib/date.js`
- Test: `src/lib/date.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `fmtTime(d, format = "12")`, `fmtClock(d, format = "12")`,
  `fmtRange(start, end, format = "12")`, `fmtFullDate(d)` (e.g. "Wednesday,
  September 9"), `MONTH_LONG` (array of 12 full month names, parallel to the
  existing `MONTH_SHORT`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/date.test.js`:

```js
import { fmtTime, fmtClock, fmtRange, fmtFullDate } from "./date.js";

describe("fmtTime", () => {
  it("defaults to 12-hour with a lowercase am/pm suffix", () => {
    expect(fmtTime(new Date(2000, 0, 1, 8, 0))).toBe("8a");
    expect(fmtTime(new Date(2000, 0, 1, 20, 15))).toBe("8:15p");
  });

  it("renders 24-hour with no suffix when asked", () => {
    expect(fmtTime(new Date(2000, 0, 1, 8, 0), "24")).toBe("8:00");
    expect(fmtTime(new Date(2000, 0, 1, 20, 15), "24")).toBe("20:15");
    expect(fmtTime(new Date(2000, 0, 1, 0, 5), "24")).toBe("0:05");
  });
});

describe("fmtClock", () => {
  it("defaults to 12-hour, no am/pm suffix (today's clock behavior)", () => {
    expect(fmtClock(new Date(2000, 0, 1, 15, 5))).toBe("3:05");
    expect(fmtClock(new Date(2000, 0, 1, 0, 5))).toBe("12:05");
  });

  it("renders 24-hour when asked", () => {
    expect(fmtClock(new Date(2000, 0, 1, 15, 5), "24")).toBe("15:05");
    expect(fmtClock(new Date(2000, 0, 1, 0, 5), "24")).toBe("00:05");
  });
});

describe("fmtRange", () => {
  it("passes the format through to both ends", () => {
    const start = new Date(2000, 0, 1, 8, 0);
    const end = new Date(2000, 0, 1, 9, 30);
    expect(fmtRange(start, end, "24")).toBe("08:00 - 09:30");
  });
});

describe("fmtFullDate", () => {
  it("renders the full weekday and month name", () => {
    expect(fmtFullDate(new Date(2026, 8, 9))).toBe("Wednesday, September 9");
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- date.test.js`
Expected: FAIL (`fmtFullDate` not exported; 24h formatting not implemented).

- [ ] **Step 3: Implement**

Replace the existing `fmtTime`/`fmtRange`/`fmtClock` in `src/lib/date.js` and
add `MONTH_LONG`/`fmtFullDate`:

```js
export function fmtTime(d, format = "12") {
  const h = d.getHours();
  const m = d.getMinutes();
  if (format === "24") {
    return `${h}:${String(m).padStart(2, "0")}`;
  }
  const ap = h >= 12 ? "p" : "a";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}`;
}

export function fmtRange(start, end, format = "12") {
  return `${fmtTime(start, format)} - ${fmtTime(end, format)}`;
}

/* "Tue, Sep 15" — the WeatherDaySheet title, using DOW/MONTH_SHORT below
   rather than a new label table since both already exist for the same
   abbreviated style. */
export function fmtLongDate(d) {
  return `${DOW[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/* "Wednesday, September 9" — the event-form date field, using the long
   weekday/month tables since the abbreviated fmtLongDate above reads too
   terse for a field the user edits directly rather than skims. */
export function fmtFullDate(d) {
  return `${DOW_LONG[d.getDay()]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}`;
}

export function fmtClock(d, format = "12") {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  if (format === "24") {
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  const h12 = h % 12 || 12;
  return `${h12}:${m}`;
}
```

Add `MONTH_LONG` next to the existing `MONTH_SHORT` array:

```js
export const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
```

(`fmtLongDate` is unchanged — shown above only so `fmtFullDate` can be placed
next to it with a comment explaining the difference.)

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- date.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/date.js src/lib/date.test.js
git commit -m "Make fmtTime/fmtClock/fmtRange format-aware, add fmtFullDate"
```

---

### Task 3: Thread `timeFormat` through every display component

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/shell/Header.jsx`
- Modify: `src/components/weather/WeatherWidget.jsx`
- Modify: `src/components/weather/WeatherRowList.jsx`
- Modify: `src/components/weather/WeatherDaySheet.jsx`
- Modify: `src/components/views/MonthView.jsx`
- Modify: `src/components/views/AgendaView.jsx`
- Modify: `src/components/views/DayView.jsx`
- Modify: `src/components/views/WeekView.jsx`
- Modify: `src/components/views/TimeGutter.jsx`
- Modify: `src/components/idle/Screensaver.jsx`
- Modify: `src/components/idle/SleepVeil.jsx`

**Interfaces:**
- Consumes: `fmtTime(d, format)` / `fmtClock(d, format)` / `fmtRange(s, e,
  format)` from Task 2 (all default to `"12"` if `format` is `undefined`).
- Produces: every one of these components now reads a real 12h/24h choice
  from `settings.timeFormat` in the running app.

No component in this task gets new tests — every one either already has no
test file, or has a test file that never passes `settings`/`timeFormat`
today. Since every `fmt*` call defaults to `"12"`, passing `settings?.timeFormat`
(or `settings.timeFormat` where `settings` is already a required prop) changes
nothing for a caller that hands over no settings at all. Confirmed test files
today: `AgendaView.test.jsx`, `DayView.test.jsx`, `WeekView.test.jsx`,
`MonthView.test.jsx`, `WeatherWidget.test.jsx` — none assert on a specific
12h-vs-24h rendering, so they keep passing unmodified.

- [ ] **Step 1: `TimeGutter` — accept and use `timeFormat`**

`src/components/views/TimeGutter.jsx`, change the signature and the one
`fmtTime` call:

```js
export function TimeGutter({ hours, hourH, timeFormat }) {
  return (
    <div className="fb-gutter fb-hours">
      {hours.map((h) => (
        <span className="fb-hour" style={{ height: hourH }} key={h}>
          {fmtTime(new Date(2000, 0, 1, h), timeFormat)}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `DayView` — pass `timeFormat` down, format its own labels**

`src/components/views/DayView.jsx`:
- Line 113: `<TimeGutter hours={hours} hourH={HOUR_H} timeFormat={settings.timeFormat} />`
- Line 156 (the `fmtRange`/`fmtTime` ternary): pass `settings.timeFormat` as
  the extra argument to both:
  `tier === "stacked" ? fmtRange(e.start, e.end, settings.timeFormat) : fmtTime(e.start, settings.timeFormat)`

- [ ] **Step 3: `WeekView` — same two edits**

`src/components/views/WeekView.jsx`:
- Line 121: `<TimeGutter hours={hours} hourH={HOUR_H} timeFormat={settings.timeFormat} />`
- Line 164: same ternary edit as DayView above, using `settings.timeFormat`.

- [ ] **Step 4: `AgendaView` — accept `settings`, format its one label**

`src/components/views/AgendaView.jsx` line 32, add `settings` to the
destructured props:

```js
export function AgendaView({ date, now, events, members, settings, onSelect }) {
```

Line 84:

```js
<span className="fb-atime">{e.allDay ? "All day" : fmtTime(e.start, settings?.timeFormat)}</span>
```

(`settings?.timeFormat` — optional chaining — because `AgendaView.test.jsx`
does not pass `settings` and should not have to; `fmtTime`'s own default
parameter covers the rest.)

- [ ] **Step 5: `Header` — accept `timeFormat`, pass to `WeatherWidget`**

`src/components/shell/Header.jsx`: add `timeFormat` to the destructured props
(line 40 area), then:
- Line 75: `<WeatherWidget now={now} snapshot={weather} timeFormat={timeFormat} />`
- Line 76: `<span className="fb-clock">{fmtClock(now, timeFormat)}</span>`

- [ ] **Step 6: `WeatherWidget` — accept and forward `timeFormat`**

`src/components/weather/WeatherWidget.jsx` line 26, add `timeFormat`:

```js
export function WeatherWidget({ now, snapshot, timeFormat }) {
```

Line 62: `<WeatherRowList rows={rows} timeFormat={timeFormat} />`
Line 64: `{stale && <div className="fb-weatherstale">Updated {fmtTime(snapshot.fetchedAt, timeFormat)} — offline</div>}`

- [ ] **Step 7: `WeatherRowList` — accept `timeFormat`, use it on all four labels**

`src/components/weather/WeatherRowList.jsx` line 15, add `timeFormat`:

```js
export function WeatherRowList({ rows, timeFormat }) {
```

Update all four `fmtTime(r.at)` call sites (lines 34, 40, 43, 47) to
`fmtTime(r.at, timeFormat)`.

- [ ] **Step 8: `WeatherDaySheet` — accept and forward `timeFormat`**

`src/components/weather/WeatherDaySheet.jsx` line 15:

```js
export function WeatherDaySheet({ day, now, timeFormat, onClose }) {
```

Line 25: `<WeatherRowList rows={rows} timeFormat={timeFormat} />`

- [ ] **Step 9: `MonthView` — accept `settings`, forward to `WeatherDaySheet`**

`src/components/views/MonthView.jsx` line 51, add `settings`:

```js
export function MonthView({ date, now, events, weather, settings, onPick, onSelect }) {
```

Line 136: `<WeatherDaySheet day={forecastDay} now={now} timeFormat={settings?.timeFormat} onClose={() => setForecastDay(null)} />`

- [ ] **Step 10: `Screensaver` — accept and use `timeFormat`**

`src/components/idle/Screensaver.jsx` line 25:

```js
export function Screensaver({ now, art, photos, events, timeFormat }) {
```

Update its two format calls (lines 49, 55) to pass `timeFormat`:
`{fmtClock(now, timeFormat)}` and `at {fmtTime(next.start, timeFormat)}`.

- [ ] **Step 11: `SleepVeil` — accept and use `timeFormat`**

`src/components/idle/SleepVeil.jsx` line 15:

```js
export function SleepVeil({ now, opacity, onWake, timeFormat }) {
```

Line 19: `<span className="fb-veilclock">{fmtClock(now, timeFormat)}</span>`

- [ ] **Step 12: `App.jsx` — wire `settings.timeFormat` into every one of the above**

In `src/App.jsx`:
- `<Header ...>` (line 238 area): add `timeFormat={settings.timeFormat}`.
- `<AgendaView ...>` (line 313 area): add `settings={settings}`.
- `<MonthView ...>` (line 298 area): add `settings={settings}`.
- `<Screensaver ...>` (line 382): add `timeFormat={settings.timeFormat}`.
- `<SleepVeil ...>` (line 385 area): add `timeFormat={settings.timeFormat}`.
- `<DayView>`/`<WeekView>` already receive `settings={settings}` — no change
  needed there beyond Steps 2-3 above, which read `settings.timeFormat` off
  the prop they already have.

- [ ] **Step 13: Run the full test suite**

Run: `npm test`
Expected: PASS — every existing test unaffected (see the note above Step 1).

- [ ] **Step 14: Commit**

```bash
git add src/App.jsx src/components/shell/Header.jsx src/components/weather/WeatherWidget.jsx src/components/weather/WeatherRowList.jsx src/components/weather/WeatherDaySheet.jsx src/components/views/MonthView.jsx src/components/views/AgendaView.jsx src/components/views/DayView.jsx src/components/views/WeekView.jsx src/components/views/TimeGutter.jsx src/components/idle/Screensaver.jsx src/components/idle/SleepVeil.jsx
git commit -m "Thread settings.timeFormat through every time display"
```

---

### Task 4: Settings.jsx — 12h/24h toggle UI

**Files:**
- Modify: `src/components/settings/Settings.jsx`
- Test: `src/components/settings/Settings.test.jsx`

**Interfaces:**
- Consumes: `settings.timeFormat`, the `set(key, value)` helper already
  defined at `Settings.jsx:71`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/settings/Settings.test.jsx`, following the existing
`renderSettings`/`describe("Settings' Sleep section"...)` pattern already in
that file:

```js
describe("Settings' time format toggle", () => {
  it("shows 12-hour and 24-hour pills, defaulting to 12-hour", () => {
    renderSettings({ timeFormat: "12" });
    expect(screen.getByRole("button", { name: "12-hour" })).toHaveClass("is-on");
    expect(screen.getByRole("button", { name: "24-hour" })).not.toHaveClass("is-on");
  });

  it("picking 24-hour calls setSettings with timeFormat: 24", async () => {
    const user = userEvent.setup();
    const setSettings = renderSettings({ timeFormat: "12" });
    await user.click(screen.getByRole("button", { name: "24-hour" }));
    const updater = setSettings.mock.calls.at(-1)[0];
    expect(updater(DEFAULT_SETTINGS).timeFormat).toBe("24");
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- Settings.test.jsx`
Expected: FAIL — no "12-hour"/"24-hour" buttons exist yet.

- [ ] **Step 3: Add the toggle, next to the existing °F/°C pills**

In `src/components/settings/Settings.jsx`, add a new `Field` right after the
"Hours shown on the day and week views" `Field` (which ends around line 513,
right before the "Weather" `Field` begins):

```jsx
<Field label="Time format">
  <div className="fb-pills">
    {[
      { key: "12", label: "12-hour" },
      { key: "24", label: "24-hour" },
    ].map((opt) => (
      <button
        key={opt.key}
        className={`fb-pill${settings.timeFormat === opt.key ? " is-on" : ""}`}
        onClick={() => set("timeFormat", opt.key)}
      >
        {opt.label}
      </button>
    ))}
  </div>
</Field>
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- Settings.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/Settings.jsx src/components/settings/Settings.test.jsx
git commit -m "Add a 12-hour/24-hour pill toggle to Settings"
```

---

### Task 5: `description` field — schema and Google sync

**Files:**
- Modify: `src/contracts/schema.js` (Event typedef + `normalizeEvent`, ~line 95-154)
- Modify: `src/data/google.js` (`mapGoogleEvent` / `toGoogleEventBody`, ~line 192-234)
- Test: `src/data/google.test.js`

**Interfaces:**
- Produces: `Event.description: string` (defaults to `""`, same rule as
  `location`), round-tripped through Google's own `description` field.

- [ ] **Step 1: Write the failing Google round-trip test**

Add to `src/data/google.test.js`, inside (or right after) the existing
`describe("write-back", ...)` block, following the exact pattern of the
milestone round-trip test at line 651:

```js
it("round-trips description through Google's native description field", async () => {
  await seedSettings([{ id: CAL, memberIds: ["brian"], enabled: true, accessRole: "owner" }]);
  let posted;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      if (init?.method === "POST") {
        posted = JSON.parse(init.body);
        return respond(200, { ok: true, item: { ...posted.event, id: "evt-1", etag: '"e1"' } });
      }
      return respond(200, { ok: true, items: [] });
    }),
  );

  const source = createGoogleSource({ apiBase: API_BASE, deviceSecret: SECRET });
  const created = await source.create({
    title: "Dentist",
    start: new Date("2026-10-01T15:00:00Z"),
    end: new Date("2026-10-01T15:30:00Z"),
    allDay: false,
    memberIds: ["brian"],
    description: "Bring insurance card",
  });

  expect(posted.event.description).toBe("Bring insurance card");
  expect(created.description).toBe("Bring insurance card");
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- google.test.js`
Expected: FAIL — `posted.event.description` is `undefined`.

- [ ] **Step 3: Add `description` to the Event typedef and `normalizeEvent`**

In `src/contracts/schema.js`, add to the `Event` typedef JSDoc (right after
`@property {string} location`):

```js
 * @property {string}   description Free text. "" when absent.
```

In `normalizeEvent`'s returned object (right after `location:` in the `out`
object, ~line 146):

```js
    location: typeof e.location === "string" ? e.location : "",
    description: typeof e.description === "string" ? e.description : "",
```

- [ ] **Step 4: Map it in `google.js`**

In `src/data/google.js`, `mapGoogleEvent` (right after `location:` at ~line
206):

```js
      location: raw.location || "",
      description: raw.description || "",
```

In `toGoogleEventBody` (right after the `location` line at ~line 218):

```js
    if (fields.location !== undefined) body.location = fields.location;
    if (fields.description !== undefined) body.description = fields.description;
```

- [ ] **Step 5: Run, confirm pass**

Run: `npm test -- google.test.js`
Expected: PASS

- [ ] **Step 6: Run the full suite** (normalizeEvent is used everywhere; confirm nothing else broke)

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/contracts/schema.js src/data/google.js src/data/google.test.js
git commit -m "Add description field to the event schema, synced to Google"
```

---

### Task 6: `lib/time.js` — pure time-of-day helpers

**Files:**
- Create: `src/lib/time.js`
- Test: `src/lib/time.test.js`

**Interfaces:**
- Produces: `parseTimeText(text): number|null` (minutes-since-midnight,
  0-1439, or `null` if unparseable), `durationLabel(minutes): string` (e.g.
  `"15 mins"`, `"1 hr"`, `"1 hr 30 mins"`), `wrapDuration(endMin, startMin):
  number` (always 1-1440, never 0 or negative).

This is the highest-value-per-line file in the whole plan — the free-text
time parser and the duration math both feed directly into `TimeField`
(Task 8) and are far cheaper to get right here, against plain numbers, than
through a rendered popover.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/time.test.js`:

```js
import { describe, it, expect } from "vitest";

import { parseTimeText, durationLabel, wrapDuration } from "./time.js";

describe("parseTimeText", () => {
  it("parses a bare hour as that hour, on the hour", () => {
    expect(parseTimeText("8")).toBe(8 * 60);
  });

  it("parses HH:MM with no suffix as 24-hour", () => {
    expect(parseTimeText("20:15")).toBe(20 * 60 + 15);
    expect(parseTimeText("0:05")).toBe(5);
  });

  it("parses a 12-hour value with an am/pm suffix, with or without a colon", () => {
    expect(parseTimeText("8:15am")).toBe(8 * 60 + 15);
    expect(parseTimeText("8:15pm")).toBe(20 * 60 + 15);
    expect(parseTimeText("815pm")).toBe(20 * 60 + 15);
    expect(parseTimeText("8:15 AM")).toBe(8 * 60 + 15);
  });

  it("treats 12am as midnight and 12pm as noon", () => {
    expect(parseTimeText("12am")).toBe(0);
    expect(parseTimeText("12pm")).toBe(12 * 60);
  });

  it("rejects an out-of-range 24-hour value", () => {
    expect(parseTimeText("25:00")).toBeNull();
  });

  it("rejects an out-of-range 12-hour value", () => {
    expect(parseTimeText("13pm")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseTimeText("abc")).toBeNull();
    expect(parseTimeText("")).toBeNull();
    expect(parseTimeText("8:75")).toBeNull();
  });
});

describe("durationLabel", () => {
  it("renders minutes under an hour", () => {
    expect(durationLabel(15)).toBe("15 mins");
    expect(durationLabel(1)).toBe("1 min");
  });

  it("renders whole hours", () => {
    expect(durationLabel(60)).toBe("1 hr");
    expect(durationLabel(120)).toBe("2 hrs");
  });

  it("renders hours plus minutes", () => {
    expect(durationLabel(90)).toBe("1 hr 30 mins");
    expect(durationLabel(75)).toBe("1 hr 15 mins");
  });
});

describe("wrapDuration", () => {
  it("returns a plain positive difference when end is after start", () => {
    expect(wrapDuration(9 * 60, 8 * 60)).toBe(60);
  });

  it("wraps past midnight when end is before start", () => {
    expect(wrapDuration(7 * 60, 8 * 60)).toBe(23 * 60);
  });

  it("treats an identical end and start as a full 24 hours, never zero", () => {
    expect(wrapDuration(8 * 60, 8 * 60)).toBe(1440);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- time.test.js`
Expected: FAIL — `src/lib/time.js` does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/time.js`:

```js
/*
  Pure helpers for the timing row's minutes-since-midnight (0-1439) currency.
  Kept apart from lib/date.js because these operate on plain numbers, not
  Dates — the picker's 96 fifteen-minute slots and the free-text field both
  work in this unit before a Date is ever built.
*/

const TIME_RE = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/i;

/**
 * @param {string} text
 * @returns {number|null} minutes since midnight (0-1439), or null if `text`
 *   isn't a recognizable time.
 */
export function parseTimeText(text) {
  const m = TIME_RE.exec(String(text).trim());
  if (!m) return null;

  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const suffix = m[3]?.toLowerCase();
  if (min > 59) return null;

  if (suffix) {
    if (h < 1 || h > 12) return null;
    h = h % 12;
    if (suffix[0] === "p") h += 12;
  } else if (h > 23) {
    return null;
  }

  return h * 60 + min;
}

/**
 * @param {number} minutes duration in minutes, > 0
 * @returns {string} "15 mins" / "1 hr" / "1 hr 30 mins"
 */
export function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hourPart = `${h} hr${h === 1 ? "" : "s"}`;
  return m ? `${hourPart} ${m} min${m === 1 ? "" : "s"}` : hourPart;
}

/**
 * Minutes from `startMin` to `endMin`, wrapping past midnight instead of
 * going negative. An identical pair is a full day, not zero — there is no
 * such thing as a zero-length event in this picker.
 *
 * @param {number} endMin
 * @param {number} startMin
 * @returns {number} 1-1440
 */
export function wrapDuration(endMin, startMin) {
  const diff = (endMin - startMin + 1440) % 1440;
  return diff === 0 ? 1440 : diff;
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- time.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.js src/lib/time.test.js
git commit -m "Add lib/time.js — time-text parsing and duration helpers"
```

---

### Task 7: New icons — Clock, Person, Pin, Notebook

**Files:**
- Modify: `src/components/shell/icons.jsx`

**Interfaces:**
- Produces: `Clock`, `Person`, `Pin`, `Notebook` — named exports, each a
  zero-prop `() => JSX` component, matching every existing icon in this file.

- [ ] **Step 1: Add the four icons**

Append to `src/components/shell/icons.jsx`, matching the file's existing
24x24 / `currentColor` / 1.7-1.8 stroke idiom:

```jsx
export const Clock = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
  >
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3.2 2" />
  </svg>
);

export const Person = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
  >
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" />
  </svg>
);

export const Pin = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
  >
    <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </svg>
);

export const Notebook = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
  >
    <rect x="4" y="3.5" width="13" height="17" rx="1.6" />
    <path d="M7 8h7M7 12h7M7 16h4" />
    <path d="M17.2 14.2 20.5 17.5 18 20l-3.3-3.3z" />
  </svg>
);
```

- [ ] **Step 2: Sanity-check the file still parses**

Run: `npm test -- icons`
Expected: no test file matches "icons" and Vitest reports "No test files
found" — that's fine, this step only needs to confirm the file has no syntax
error, which the next task's tests (importing these icons) will do for real.

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/icons.jsx
git commit -m "Add Clock/Person/Pin/Notebook icons for the event form"
```

---

### Task 8: `DateField` — self-contained date button + month popover

**Files:**
- Create: `src/components/shell/DateField.jsx`
- Test: `src/components/shell/DateField.test.jsx`
- Modify: `src/styles/shell/Sheet.js` (append popover-content styles)

**Interfaces:**
- Consumes: `stepAnchor("month", anchor, dir)`, `sameDay`, `startOfDay`,
  `dayKey`, `fmtFullDate`, `DOW_LONG`, `MONTH_LONG` from `src/lib/date.js`.
  Reuses `.fb-headdd`/`.fb-ddscrim`/`.fb-ddpop`/`.fb-ddopt` from
  `src/styles/shell/HeaderControls.js` (already loaded globally).
- Produces: `<DateField value={Date} onChange={(d: Date) => void} minDate?=
  {Date} ariaLabel={string} />` — a button showing `fmtFullDate(value)` that
  opens a month-grid popover on click; picking a day calls `onChange` and
  closes the popover. Used by both the start-date and end-date fields in
  Task 10.

- [ ] **Step 1: Write the failing tests**

Create `src/components/shell/DateField.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateField } from "./DateField.jsx";

describe("DateField", () => {
  it("shows the full formatted date and no popover until clicked", () => {
    render(<DateField value={new Date(2026, 8, 9)} onChange={() => {}} ariaLabel="Event date" />);
    expect(screen.getByRole("button", { name: "Event date" })).toHaveTextContent(
      "Wednesday, September 9",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a month grid on click, showing the value's month", async () => {
    const user = userEvent.setup();
    render(<DateField value={new Date(2026, 8, 9)} onChange={() => {}} ariaLabel="Event date" />);
    await user.click(screen.getByRole("button", { name: "Event date" }));
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9" })).toHaveClass("is-on");
  });

  it("picking a day calls onChange with that date and closes the popover", async () => {
    const user = userEvent.setup();
    let picked = null;
    render(
      <DateField
        value={new Date(2026, 8, 9)}
        onChange={(d) => (picked = d)}
        ariaLabel="Event date"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(screen.getByRole("button", { name: "15" }));
    expect(picked).toEqual(new Date(2026, 8, 15));
    expect(screen.queryByText("September 2026")).not.toBeInTheDocument();
  });

  it("disables days before minDate", async () => {
    const user = userEvent.setup();
    render(
      <DateField
        value={new Date(2026, 8, 9)}
        onChange={() => {}}
        minDate={new Date(2026, 8, 9)}
        ariaLabel="End date"
      />,
    );
    await user.click(screen.getByRole("button", { name: "End date" }));
    expect(screen.getByRole("button", { name: "5" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "9" })).not.toBeDisabled();
  });

  it("pages to the next/previous month without changing the selected value", async () => {
    const user = userEvent.setup();
    render(<DateField value={new Date(2026, 8, 9)} onChange={() => {}} ariaLabel="Event date" />);
    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("October 2026")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- DateField.test.jsx`
Expected: FAIL — the module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/components/shell/DateField.jsx`:

```jsx
import { useState } from "react";

import { stepAnchor, sameDay, startOfDay, dayKey, fmtFullDate, DOW_LONG, MONTH_LONG } from "../../lib/date.js";

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/*
  A button reading the full date ("Wednesday, September 9") that opens a
  month-grid popover on click. Built on the same fb-headdd/fb-ddscrim/fb-ddpop
  mechanics MemberPicker and ViewSwitcher already use — one popover recipe,
  reused rather than reinvented for the event form's date fields.
*/
export function DateField({ value, onChange, minDate, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value));

  const openPicker = () => {
    setViewMonth(startOfMonth(value));
    setOpen(true);
  };

  const pick = (day) => {
    onChange(day);
    setOpen(false);
  };

  const firstWeekday = startOfMonth(viewMonth).getDay();
  const count = daysInMonth(viewMonth);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  const floor = minDate ? startOfDay(minDate) : null;

  return (
    <div className="fb-headdd fb-datefield">
      <button type="button" className="fb-timingfield" onClick={openPicker} aria-label={ariaLabel}>
        {fmtFullDate(value)}
      </button>
      {open && (
        <>
          <div className="fb-ddscrim" onClick={() => setOpen(false)} />
          <div className="fb-ddpop fb-datepop" role="dialog" aria-label={ariaLabel}>
            <div className="fb-datepop-head">
              <button
                type="button"
                className="fb-ghost-sm"
                onClick={() => setViewMonth((m) => stepAnchor("month", m, -1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <span>
                {MONTH_LONG[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </span>
              <button
                type="button"
                className="fb-ghost-sm"
                onClick={() => setViewMonth((m) => stepAnchor("month", m, 1))}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <div className="fb-datepop-dow">
              {DOW_LONG.map((d) => (
                <span key={d}>{d[0]}</span>
              ))}
            </div>
            <div className="fb-datepop-grid">
              {cells.map((day, i) =>
                day ? (
                  <button
                    type="button"
                    key={dayKey(day)}
                    className={`fb-datepop-day${sameDay(day, value) ? " is-on" : ""}`}
                    disabled={Boolean(floor && day < floor)}
                    onClick={() => pick(day)}
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <span key={`blank-${i}`} />
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add popover-content styles**

Append to `src/styles/shell/Sheet.js` (these are new classes; `.fb-headdd` /
`.fb-ddscrim` / `.fb-ddpop` / `.fb-ddopt` already exist in
`styles/shell/HeaderControls.js` and need no changes):

```css
.fb-timingfield {
  font-size: 15px; font-weight: 600; color: var(--ink);
  background: var(--surface); border-radius: 10px; padding: 10px 13px;
}
.fb-datepop { min-width: 260px; }
.fb-datepop-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 8px; font-size: 13px; font-weight: 700; }
.fb-datepop-dow { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 11px; color: var(--mute); padding-bottom: 4px; }
.fb-datepop-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.fb-datepop-day { padding: 8px 0; border-radius: 8px; font-size: 13px; color: var(--ink); }
.fb-datepop-day:hover:not(:disabled) { background: var(--surface); }
.fb-datepop-day.is-on { background: var(--ink); color: var(--paper); }
.fb-datepop-day:disabled { color: var(--mute); opacity: 0.4; }
```

- [ ] **Step 5: Run, confirm pass**

Run: `npm test -- DateField.test.jsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/DateField.jsx src/components/shell/DateField.test.jsx src/styles/shell/Sheet.js
git commit -m "Add DateField — a date button with a month-grid popover"
```

---

### Task 9: `TimeField` — self-contained time button + 15-min scroll popover + type-to-enter

**Files:**
- Create: `src/components/shell/TimeField.jsx`
- Test: `src/components/shell/TimeField.test.jsx`
- Modify: `src/styles/shell/Sheet.js` (append time-popover styles)

**Interfaces:**
- Consumes: `fmtTime` from `lib/date.js`; `parseTimeText`, `durationLabel`,
  `wrapDuration` from `lib/time.js` (Task 6).
- Produces: `<TimeField minutes={number} onChange={(m: number) => void}
  timeFormat={"12"|"24"} durationFrom?={number} ariaLabel={string} />`. When
  `durationFrom` is given (the end-time field only), each option in the list
  is annotated `(N mins)` / `(N hr M mins)`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/shell/TimeField.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimeField } from "./TimeField.jsx";

describe("TimeField", () => {
  it("shows the formatted time and no list until clicked", () => {
    render(<TimeField minutes={8 * 60} onChange={() => {}} timeFormat="12" ariaLabel="Start time" />);
    expect(screen.getByRole("button", { name: "Start time" })).toHaveTextContent("8a");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a 96-row 15-minute list on click", async () => {
    const user = userEvent.setup();
    render(<TimeField minutes={8 * 60} onChange={() => {}} timeFormat="12" ariaLabel="Start time" />);
    await user.click(screen.getByRole("button", { name: "Start time" }));
    expect(screen.getAllByRole("option")).toHaveLength(96);
    expect(screen.getByRole("option", { name: "8a" })).toHaveClass("is-on");
  });

  it("picking an option calls onChange with its minutes and closes the list", async () => {
    const user = userEvent.setup();
    let picked = null;
    render(
      <TimeField minutes={8 * 60} onChange={(m) => (picked = m)} timeFormat="12" ariaLabel="Start time" />,
    );
    await user.click(screen.getByRole("button", { name: "Start time" }));
    await user.click(screen.getByRole("option", { name: "9a" }));
    expect(picked).toBe(9 * 60);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders in 24-hour when asked", async () => {
    const user = userEvent.setup();
    render(<TimeField minutes={8 * 60} onChange={() => {}} timeFormat="24" ariaLabel="Start time" />);
    expect(screen.getByRole("button", { name: "Start time" })).toHaveTextContent("8:00");
    await user.click(screen.getByRole("button", { name: "Start time" }));
    expect(screen.getByRole("option", { name: "20:00" })).toBeInTheDocument();
  });

  it("annotates each option with its duration from durationFrom, wrapping past midnight", async () => {
    const user = userEvent.setup();
    render(
      <TimeField
        minutes={9 * 60}
        onChange={() => {}}
        timeFormat="12"
        durationFrom={8 * 60}
        ariaLabel="End time"
      />,
    );
    await user.click(screen.getByRole("button", { name: "End time" }));
    expect(screen.getByRole("option", { name: "9a (1 hr)" })).toBeInTheDocument();
    // 7am is before the 8am start, so it wraps to a 23-hour span.
    expect(screen.getByRole("option", { name: "7a (23 hrs)" })).toBeInTheDocument();
  });

  it("double-click swaps to a free-text input; a valid entry commits on blur", async () => {
    const user = userEvent.setup();
    let picked = null;
    render(
      <TimeField minutes={8 * 60} onChange={(m) => (picked = m)} timeFormat="12" ariaLabel="Start time" />,
    );
    await user.dblClick(screen.getByRole("button", { name: "Start time" }));
    const input = screen.getByRole("textbox", { name: "Start time" });
    await user.clear(input);
    await user.type(input, "9:15am");
    await user.tab();
    expect(picked).toBe(9 * 60 + 15);
  });

  it("an unparseable typed value reverts without calling onChange", async () => {
    const user = userEvent.setup();
    let called = false;
    render(
      <TimeField minutes={8 * 60} onChange={() => (called = true)} timeFormat="12" ariaLabel="Start time" />,
    );
    await user.dblClick(screen.getByRole("button", { name: "Start time" }));
    const input = screen.getByRole("textbox", { name: "Start time" });
    await user.clear(input);
    await user.type(input, "not a time");
    await user.tab();
    expect(called).toBe(false);
    expect(screen.getByRole("button", { name: "Start time" })).toHaveTextContent("8a");
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- TimeField.test.jsx`
Expected: FAIL — the module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/components/shell/TimeField.jsx`:

```jsx
import { useEffect, useRef, useState } from "react";

import { fmtTime } from "../../lib/date.js";
import { parseTimeText, durationLabel, wrapDuration } from "../../lib/time.js";

const STEP = 15;
const SLOTS = Array.from({ length: (24 * 60) / STEP }, (_, i) => i * STEP);

function label(minutes, timeFormat) {
  return fmtTime(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60), timeFormat);
}

/*
  A time button that opens a scrollable 15-minute-interval list (the one
  scrollbar the redesigned event form keeps) and, on double-click, swaps to a
  free-text input instead — parseTimeText (lib/time.js) is what makes "815pm"
  and "20:15" both land on the same slot. `durationFrom`, given only on the
  end-time field, is what makes each row read "9:00a (1 hr)" — wrapDuration
  is why an end time earlier than the start still shows a positive span
  instead of a negative one.
*/
export function TimeField({ minutes, onChange, timeFormat, durationFrom, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector('[data-active="true"]');
      if (active) active.scrollIntoView({ block: "center" });
    }
  }, [open]);

  const startTyping = () => {
    setTypedValue(label(minutes, timeFormat));
    setTyping(true);
    setOpen(false);
  };

  const commitTyped = () => {
    const parsed = parseTimeText(typedValue);
    if (parsed !== null) onChange(parsed);
    setTyping(false);
  };

  const pick = (m) => {
    onChange(m);
    setOpen(false);
  };

  if (typing) {
    return (
      <input
        className="fb-input fb-timingfield"
        autoFocus
        value={typedValue}
        onChange={(e) => setTypedValue(e.target.value)}
        onBlur={commitTyped}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <div className="fb-headdd fb-timefield">
      <button
        type="button"
        className="fb-timingfield"
        onClick={() => setOpen((o) => !o)}
        onDoubleClick={startTyping}
        aria-label={ariaLabel}
      >
        {label(minutes, timeFormat)}
      </button>
      {open && (
        <>
          <div className="fb-ddscrim" onClick={() => setOpen(false)} />
          <div className="fb-ddpop fb-timepop" role="listbox" aria-label={ariaLabel} ref={listRef}>
            {SLOTS.map((m) => (
              <button
                type="button"
                key={m}
                role="option"
                data-active={m === minutes ? "true" : undefined}
                className={`fb-ddopt fb-timeopt${m === minutes ? " is-on" : ""}`}
                onClick={() => pick(m)}
              >
                {label(m, timeFormat)}
                {durationFrom !== undefined && (
                  <span className="fb-timeopt-dur"> ({durationLabel(wrapDuration(m, durationFrom))})</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add time-popover styles**

Append to `src/styles/shell/Sheet.js`:

```css
.fb-timepop { max-height: 260px; overflow-y: auto; min-width: 200px; }
.fb-timeopt { display: flex; justify-content: space-between; width: 100%; }
.fb-timeopt-dur { color: var(--mute); font-weight: 500; }
.fb-timingrow { display: flex; align-items: center; gap: 10px; }
.fb-timingdash { color: var(--mute); }
.fb-timingend { display: flex; align-items: center; gap: 10px; padding-left: 30px; }
```

- [ ] **Step 5: Run, confirm pass**

Run: `npm test -- TimeField.test.jsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/TimeField.jsx src/components/shell/TimeField.test.jsx src/styles/shell/Sheet.js
git commit -m "Add TimeField — 15-min scrollable picker with type-to-enter"
```

---

### Task 10: `EventForm` — the shared field layout and multi-day state machine

**Files:**
- Create: `src/components/settings/EventForm.jsx`
- Test: `src/components/settings/EventForm.test.jsx`
- Modify: `src/styles/shell/Sheet.js` (append remaining field styles;
  remove now-superseded rules — see Step 6)

**Interfaces:**
- Consumes: `DateField` (Task 8), `TimeField` (Task 9), `Clock`/`Person`/
  `Pin`/`Notebook` icons (Task 7), `Avatar` (existing), `Field` (existing),
  `tint`/`splitFill`/`variantColor`/`VARIATION_COUNT` from `lib/color.js`
  (existing), `startOfDay`/`addDays`/`sameDay`/`minutesInto` from `lib/date.js`
  (existing), `useMode` from `state/ModeContext.js` (existing).
- Produces:
  - `deriveTimingState(initial)` — exported for direct testing — returns
    `{ startDate, startMinutes, endDate, endMinutes, endDateTouched }` from an
    Event-shaped `initial` (`{ start, end, allDay }`).
  - `EventForm({ initial, members, settings, placeholderTitle, renderFooter })`
    — `initial` is an Event-shaped object (`title, memberIds, variant, start,
    end, allDay, milestone, location, description`); `renderFooter(draft,
    canSave)` is called with the live assembled draft and a boolean (title
    non-empty) on every render, and must return the footer JSX. `EventForm`
    renders the preview banner, title input, timing row, All day/milestone
    checkboxes, people+shade, location, and description — everything except
    the footer.

This is the task with the actual "ROBUST" multi-day logic from the spec. Read
`docs/superpowers/specs/2026-09-10-event-form-redesign-design.md` §4 before
starting if anything below is unclear.

- [ ] **Step 1: Write the failing tests for `deriveTimingState`**

Create `src/components/settings/EventForm.test.jsx`, starting with the pure
derivation function:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EventForm, deriveTimingState } from "./EventForm.jsx";
import { ModeContext } from "../../state/ModeContext.js";

describe("deriveTimingState", () => {
  it("splits a single-day timed event into its date and two minute-of-day values", () => {
    const initial = {
      start: new Date(2026, 8, 9, 9, 0),
      end: new Date(2026, 8, 9, 9, 30),
      allDay: false,
    };
    expect(deriveTimingState(initial)).toEqual({
      startDate: new Date(2026, 8, 9),
      startMinutes: 9 * 60,
      endDate: new Date(2026, 8, 9),
      endMinutes: 9 * 60 + 30,
      endDateTouched: false,
    });
  });

  it("marks endDateTouched for an event that is already multi-day", () => {
    const initial = {
      start: new Date(2026, 8, 9, 22, 0),
      end: new Date(2026, 8, 10, 2, 0),
      allDay: false,
    };
    const s = deriveTimingState(initial);
    expect(s.endDate).toEqual(new Date(2026, 8, 10));
    expect(s.endDateTouched).toBe(true);
  });

  it("defaults to a sane 9-10am window for an all-day event, not midnight", () => {
    const initial = { start: new Date(2026, 8, 9), end: new Date(2026, 8, 9), allDay: true };
    const s = deriveTimingState(initial);
    expect(s.startMinutes).toBe(9 * 60);
    expect(s.endMinutes).toBe(10 * 60);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- EventForm.test.jsx`
Expected: FAIL — the module doesn't exist.

- [ ] **Step 3: Implement `deriveTimingState` and the component's state/effects**

Create `src/components/settings/EventForm.jsx`. Start with imports, the pure
derivation function, and the component's state:

```jsx
import { useState } from "react";

import { startOfDay, addDays, sameDay, minutesInto } from "../../lib/date.js";
import { tint, splitFill, variantColor, VARIATION_COUNT } from "../../lib/color.js";
import { useMode } from "../../state/ModeContext.js";
import { Avatar } from "../shell/Avatar.jsx";
import { Field } from "../shell/Field.jsx";
import { DateField } from "../shell/DateField.jsx";
import { TimeField } from "../shell/TimeField.jsx";
import { Clock, Person, Pin, Notebook } from "../shell/icons.jsx";

/*
  Splits an Event-shaped `initial` into the timing row's own state currency:
  a calendar-day `startDate`/`endDate` pair plus minutes-since-midnight for
  each. An all-day event carries no meaningful time of day, so it gets a
  fixed 9am-10am default rather than the misleading midnight
  `event.start.getHours()` would otherwise produce if "All day" is later
  unchecked.

  `endDateTouched` seeds `true` for an event that is already multi-day, so
  loading an existing multi-day event into the form doesn't immediately
  auto-collapse its span the first time a time field re-renders.
*/
export function deriveTimingState(initial) {
  const startDate = startOfDay(initial.start);
  const endDate = startOfDay(initial.end);
  return {
    startDate,
    startMinutes: initial.allDay ? 9 * 60 : minutesInto(initial.start),
    endDate,
    endMinutes: initial.allDay ? 10 * 60 : minutesInto(initial.end),
    endDateTouched: !sameDay(startDate, endDate),
  };
}

function wontSyncReason(calendars, memberId) {
  const cal = calendars.find((c) => c.memberIds.length === 1 && c.memberIds[0] === memberId);
  if (!cal) return "no calendar linked";
  if (cal.accessRole !== "writer" && cal.accessRole !== "owner") return "you only have view access";
  return null;
}

function atMinutes(date, minutes) {
  const d = new Date(date);
  d.setHours(0, minutes, 0, 0);
  return d;
}

export function EventForm({ initial, members, settings, placeholderTitle, renderFooter }) {
  const { calendars } = useMode();

  const [title, setTitle] = useState(initial.title);
  const [who, setWho] = useState(initial.memberIds || []);
  const [variant, setVariant] = useState(initial.variant ?? 0);
  const [location, setLocation] = useState(initial.location || "");
  const [description, setDescription] = useState(initial.description || "");
  const [allDay, setAllDay] = useState(Boolean(initial.allDay))
  const [milestone, setMilestone] = useState(Boolean(initial.milestone));

  const timing0 = deriveTimingState(initial);
  const [startDate, setStartDate] = useState(timing0.startDate);
  const [startMinutes, setStartMinutes] = useState(timing0.startMinutes);
  const [endDate, setEndDate] = useState(timing0.endDate);
  const [endMinutes, setEndMinutes] = useState(timing0.endMinutes);
  const [endDateTouched, setEndDateTouched] = useState(timing0.endDateTouched);

  /*
    The multi-day auto-detect/auto-collapse rule (spec §4): while the user
    has never explicitly opened the end-date popover, any end time at or
    before the start time reads as "the next day", and any end time after
    the start time collapses back to a single day. Once the end-date popover
    has been used directly, this stops overriding it — see applyEndDate.
  */
  const applyStartMinutes = (next) => {
    setStartMinutes(next);
    if (!endDateTouched) setEndDate(endMinutes <= next ? addDays(startDate, 1) : startDate);
  };

  const applyEndMinutes = (next) => {
    setEndMinutes(next);
    if (!endDateTouched) setEndDate(next <= startMinutes ? addDays(startDate, 1) : startDate);
  };

  const applyStartDate = (next) => {
    setStartDate(next);
    if (endDateTouched) {
      setEndDate((d) => (d < next ? next : d));
    } else {
      setEndDate(endMinutes <= startMinutes ? addDays(next, 1) : next);
    }
  };

  const applyEndDate = (next) => {
    setEndDate(next);
    setEndDateTouched(true);
  };

  const applyMilestone = (checked) => {
    setMilestone(checked);
    if (checked) {
      setAllDay(true);
      setEndDate(startDate);
      setEndDateTouched(false);
    }
  };

  const isAllDay = allDay || milestone;
  const showEndDate = !milestone && (endDateTouched || !sameDay(startDate, endDate));

  const toggle = (id) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const chosen = who.map((id) => members.find((m) => m.id === id)).filter(Boolean);
  const unsynced = chosen
    .map((m) => ({ member: m, reason: wontSyncReason(calendars, m.id) }))
    .filter((x) => x.reason);
  const preview = splitFill(
    chosen.map((m) => variantColor(m.color, variant)),
    "var(--surface)",
  );

  const draft = {
    title: title.trim(),
    memberIds: who,
    variant,
    start: isAllDay ? startOfDay(startDate) : atMinutes(startDate, startMinutes),
    end: isAllDay ? startOfDay(milestone ? startDate : endDate) : atMinutes(endDate, endMinutes),
    allDay: isAllDay,
    milestone,
    location: location.trim(),
    description: description.trim(),
  };
  const canSave = Boolean(title.trim());

  return (
    <>
      <div className="fb-preview" style={{ background: preview }}>
        {title || placeholderTitle}
      </div>

      <input
        className="fb-input fb-input-lg"
        placeholder="Add title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <div className="fb-timingblock">
        <div className="fb-timingrow">
          <Clock />
          <DateField value={startDate} onChange={applyStartDate} ariaLabel="Event date" />
          {!isAllDay && (
            <>
              <TimeField
                minutes={startMinutes}
                onChange={applyStartMinutes}
                timeFormat={settings.timeFormat}
                ariaLabel="Start time"
              />
              <span className="fb-timingdash">–</span>
              <TimeField
                minutes={endMinutes}
                onChange={applyEndMinutes}
                timeFormat={settings.timeFormat}
                durationFrom={startMinutes}
                ariaLabel="End time"
              />
            </>
          )}
        </div>
        {showEndDate && (
          <div className="fb-timingend">
            <span className="fb-inlabel">Ends</span>
            <DateField value={endDate} onChange={applyEndDate} minDate={startDate} ariaLabel="End date" />
          </div>
        )}
      </div>

      <label className="fb-check">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        <span>All day</span>
      </label>

      <label className="fb-check">
        <input
          type="checkbox"
          checked={milestone}
          onChange={(e) => applyMilestone(e.target.checked)}
        />
        <span>Count down to this on the board</span>
      </label>

      <Field label="">
        <div className="fb-iconrow">
          <Person />
          <div className="fb-pills">
            {members.map((m) => {
              const reason = who.includes(m.id) ? wontSyncReason(calendars, m.id) : null;
              return (
                <button
                  key={m.id}
                  className={`fb-avpill${who.includes(m.id) ? " is-on" : ""}`}
                  style={
                    who.includes(m.id)
                      ? { background: tint(m.color, 0.74), borderColor: m.color }
                      : undefined
                  }
                  onClick={() => toggle(m.id)}
                >
                  <span className="fb-avpill-avatar">
                    <Avatar member={m} size={28} />
                    {reason && (
                      <span className="fb-avpill-warn" title={`Won't sync — ${reason}`} aria-hidden="true">
                        !
                      </span>
                    )}
                  </span>
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
      </Field>

      {unsynced.length > 0 && (
        <p className="fb-note fb-textwarn">
          {unsynced
            .map(({ member, reason }) => `Won't be added to ${member.name}'s calendar — ${reason}.`)
            .join(" ")}
        </p>
      )}

      {chosen.length > 0 && (
        <Field label="Shade">
          <div className="fb-ramp">
            {Array.from({ length: VARIATION_COUNT }, (_, i) => (
              <button
                key={i}
                className={`fb-shade${variant === i ? " is-on" : ""}`}
                style={{
                  background: splitFill(
                    chosen.map((m) => variantColor(m.color, i)),
                    "var(--surface)",
                  ),
                }}
                onClick={() => setVariant(i)}
                aria-label={`Shade ${i + 1}`}
              />
            ))}
          </div>
        </Field>
      )}

      <div className="fb-iconrow">
        <Pin />
        <input
          className="fb-input"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="fb-iconrow fb-iconrow-top">
        <Notebook />
        <textarea
          className="fb-input fb-textarea"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {renderFooter(draft, canSave)}
    </>
  );
}
```

- [ ] **Step 4: Run the `deriveTimingState` tests, confirm they pass**

Run: `npm test -- EventForm.test.jsx`
Expected: PASS for the three `deriveTimingState` tests (the file has no
`EventForm` render tests yet).

- [ ] **Step 5: Write and pass the multi-day state-machine tests**

Append to `src/components/settings/EventForm.test.jsx`:

```jsx
const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true }];
const SETTINGS = { timeFormat: "12" };
const INITIAL = {
  title: "",
  memberIds: ["brian"],
  variant: 0,
  start: new Date(2026, 8, 9, 8, 0),
  end: new Date(2026, 8, 9, 9, 0),
  allDay: false,
  milestone: false,
  location: "",
  description: "",
};

function renderForm(initial = INITIAL, renderFooter = () => null) {
  const modeState = { mode: "personal", setMode: () => {}, roster: MEMBERS, calendars: [], views: [], isRoommate: false };
  return render(
    <ModeContext.Provider value={modeState}>
      <EventForm
        initial={initial}
        members={MEMBERS}
        settings={SETTINGS}
        placeholderTitle="New event"
        renderFooter={renderFooter}
      />
    </ModeContext.Provider>,
  );
}

describe("EventForm's multi-day auto-detection", () => {
  it("has no end-date field for a normal same-day event", () => {
    renderForm();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });

  it("reveals the end-date field, defaulted to the next day, once the end time is at or before the start", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: "7a" })); // before the 8am start
    expect(screen.getByLabelText("End date")).toHaveTextContent("Thursday, September 10");
  });

  it("collapses the end-date field again if the end time moves back after the start, while untouched", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: "7a" }));
    expect(screen.getByLabelText("End date")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: "10a" })); // after the 8am start again
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });

  it("stops auto-collapsing once the end-date popover has been used directly", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: "7a" })); // reveals the end-date field
    await user.click(screen.getByLabelText("End date"));
    await user.click(screen.getByRole("button", { name: "20" })); // Sep 20, explicit pick
    expect(screen.getByLabelText("End date")).toHaveTextContent("Sunday, September 20");

    // Now push the end time back above the start time — a touched span must not collapse.
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: "10a" }));
    expect(screen.getByLabelText("End date")).toHaveTextContent("Sunday, September 20");
  });

  it("All day reuses the same end-date field for an already multi-day span", () => {
    const multiDayAllDay = {
      ...INITIAL,
      allDay: true,
      start: new Date(2026, 8, 9),
      end: new Date(2026, 8, 12),
    };
    renderForm(multiDayAllDay);
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toHaveTextContent("Saturday, September 12");
  });

  it("checking All day on a same-day timed event hides times without revealing an end date", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("checkbox", { name: "All day" }));
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });

  it("a milestone forces single-day and hides the end-date field even if it was showing", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "End time" }));
    await user.click(screen.getByRole("option", { name: "7a" }));
    expect(screen.getByLabelText("End date")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Count down to this on the board" }));
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
  });

  it("assembles start/end from the date+minutes state on save", async () => {
    const user = userEvent.setup();
    let lastDraft = null;
    renderForm(INITIAL, (draft) => {
      lastDraft = draft;
      return (
        <button onClick={() => {}} disabled={!draft.title}>
          save probe
        </button>
      );
    });
    await user.type(screen.getByPlaceholderText("Add title"), "Standup");
    expect(lastDraft.title).toBe("Standup");
    expect(lastDraft.start).toEqual(new Date(2026, 8, 9, 8, 0));
    expect(lastDraft.end).toEqual(new Date(2026, 8, 9, 9, 0));
  });
});
```

Run: `npm test -- EventForm.test.jsx`
Expected: PASS. If any assertion about button/option names fails, check the
exact label rendered by `fmtTime`/`fmtFullDate` for the dates/times in play
(e.g. `DOW_LONG`/`MONTH_LONG` spelling) rather than changing the production
logic — the state machine itself should not need adjustment once the plan's
`applyStartMinutes`/`applyEndMinutes`/`applyStartDate`/`applyEndDate` are
implemented exactly as written in Step 3.

- [ ] **Step 6: Append remaining field styles, remove now-dead ones**

Append to `src/styles/shell/Sheet.js`:

```css
.fb-timingblock { display: flex; flex-direction: column; gap: 10px; }
.fb-iconrow { display: flex; align-items: center; gap: 12px; }
.fb-iconrow-top { align-items: flex-start; padding-top: 2px; }
.fb-iconrow svg { flex: none; color: var(--mute); }
.fb-textarea { min-height: 72px; resize: vertical; font-family: inherit; }
```

Then remove the two now-unused rules (nothing renders `.fb-pills-scroll` once
Task 11/12 finish rewriting Composer/EventDetailSheet, and `.fb-sheetbody`
should size to content instead of scrolling — see Task 13's line-by-line
removal, which runs after both wrappers are rewritten so this file's tests
don't regress mid-task). **Do not remove them in this task** — only note here
that they are now dead; Task 13 deletes them once nothing references them.

- [ ] **Step 7: Run the full suite, confirm nothing else broke**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/settings/EventForm.jsx src/components/settings/EventForm.test.jsx src/styles/shell/Sheet.js
git commit -m "Add EventForm — the shared field layout and multi-day state machine"
```

---

### Task 11: `Composer.jsx` — rewrite as a thin `EventForm` wrapper

**Files:**
- Modify: `src/components/settings/Composer.jsx`
- Modify: `src/components/settings/Composer.test.jsx`

**Interfaces:**
- Consumes: `EventForm` (Task 10).
- Produces: `Composer({ members, date, settings, onSave, onClose })` — same
  external signature as today, so `App.jsx` needs no changes.

- [ ] **Step 1: Rewrite `Composer.jsx`**

Replace the entire contents of `src/components/settings/Composer.jsx` with:

```jsx
import { Sheet } from "../shell/Sheet.jsx";
import { EventForm } from "./EventForm.jsx";

/*
  New-event composer — now a thin wrapper around EventForm (the fields/state/
  multi-day logic all live there, shared with EventDetailSheet). This file
  only owns: the initial draft's defaults, the sheet chrome, and the
  Cancel/Add footer.
*/
export function Composer({ members, date, settings, onSave, onClose }) {
  const start = new Date(date);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60000);

  const initial = {
    title: "",
    memberIds: [members[0]?.id].filter(Boolean),
    variant: 0,
    start,
    end,
    allDay: false,
    milestone: false,
    location: "",
    description: "",
  };

  return (
    <Sheet title="New event" onClose={onClose}>
      <EventForm
        initial={initial}
        members={members}
        settings={settings}
        placeholderTitle="New event"
        renderFooter={(draft, canSave) => (
          <div className="fb-sheetfoot">
            <button className="fb-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="fb-primary" disabled={!canSave} onClick={() => canSave && onSave(draft)}>
              Add event
            </button>
          </div>
        )}
      />
    </Sheet>
  );
}
```

- [ ] **Step 2: Rewrite `Composer.test.jsx` for the new UI**

Replace `src/components/settings/Composer.test.jsx` entirely:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Composer } from "./Composer.jsx";
import { ModeContext } from "../../state/ModeContext.js";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true }];
const DATE = new Date(2026, 2, 15);
const noop = () => {};

function renderComposer(second = {}) {
  const options = typeof second === "function" ? { onSave: second } : second;
  const { members = MEMBERS, calendars = [], onSave = noop } = options;
  const modeState = { mode: "personal", setMode: noop, roster: members, calendars, views: [], isRoommate: false };
  return render(
    <ModeContext.Provider value={modeState}>
      <Composer members={members} date={DATE} settings={{ timeFormat: "12" }} onSave={onSave} onClose={noop} />
    </ModeContext.Provider>,
  );
}

describe("Composer", () => {
  it("defaults to a 6-8pm... actually 6-7pm same-day event on the given date", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderComposer(onSave);
    await user.type(screen.getByPlaceholderText("Add title"), "Standup");
    await user.click(screen.getByRole("button", { name: "Add event" }));

    const draft = onSave.mock.calls[0][0];
    expect(draft.start).toEqual(new Date(2026, 2, 15, 18, 0));
    expect(draft.end).toEqual(new Date(2026, 2, 15, 19, 0));
  });

  it("keeps the Add button disabled until a title is entered", () => {
    renderComposer();
    expect(screen.getByRole("button", { name: "Add event" })).toBeDisabled();
  });

  it("Cancel calls onClose without saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <ModeContext.Provider value={{ mode: "personal", setMode: noop, roster: MEMBERS, calendars: [], views: [], isRoommate: false }}>
        <Composer members={MEMBERS} date={DATE} settings={{ timeFormat: "12" }} onSave={onSave} onClose={onClose} />
      </ModeContext.Provider>,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows the read-only-calendar warning for a toggled member with no write access", async () => {
    const user = userEvent.setup();
    const members = [
      { id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true },
      { id: "rachel", name: "Rachel", color: "#F0A3B8", onBoard: true },
    ];
    const calendars = [
      { id: "brian@x.com", memberIds: ["brian"], enabled: true, accessRole: "writer" },
      { id: "rachel@x.com", memberIds: ["rachel"], enabled: true, accessRole: "reader" },
    ];
    renderComposer({ members, calendars });

    expect(screen.queryByText(/won.t be added/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /rachel/i }));
    expect(screen.getByText(/won.t be added to rachel.*view access/i)).toBeInTheDocument();
  });

  it("saves an all-day event spanning the picked start and end days", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderComposer(onSave);
    await user.type(screen.getByPlaceholderText("Add title"), "Kauai");
    await user.click(screen.getByRole("checkbox", { name: "All day" }));
    await user.click(screen.getByLabelText("Event date"));
    await user.click(screen.getByRole("button", { name: "18" }));
    // Untouched end date follows the start date for a same-day all-day event.
    await user.click(screen.getByRole("button", { name: "Add event" }));

    const draft = onSave.mock.calls[0][0];
    expect(draft.allDay).toBe(true);
    expect(draft.start).toEqual(new Date(2026, 2, 18));
    expect(draft.end).toEqual(new Date(2026, 2, 18));
  });

  it("keeps a milestone single-day", async () => {
    const user = userEvent.setup();
    renderComposer();
    await user.click(screen.getByRole("checkbox", { name: "Count down to this on the board" }));
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run, fix, confirm pass**

Run: `npm test -- Composer.test.jsx`
Expected: PASS. If the "18" button-name assertion collides with another
same-numbered day rendered elsewhere in the popover (it shouldn't — only one
month grid is open at a time), scope the query with
`within(screen.getByRole("dialog"))` the same way `Composer.test.jsx` used
to scope with `within(dayField)`.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/Composer.jsx src/components/settings/Composer.test.jsx
git commit -m "Rewrite Composer as a thin EventForm wrapper"
```

---

### Task 12: `EventDetailSheet.jsx` — rewrite as a thin `EventForm` wrapper

**Files:**
- Modify: `src/components/views/EventDetailSheet.jsx`
- Modify: `src/components/views/EventDetailSheet.test.jsx`

**Interfaces:**
- Consumes: `EventForm` (Task 10).
- Produces: `EventDetailSheet({ event, members, settings, onSave, onDelete,
  onClose })` — same external signature as today.

- [ ] **Step 1: Rewrite `EventDetailSheet.jsx`**

Replace the entire contents of `src/components/views/EventDetailSheet.jsx`
with:

```jsx
import { useState } from "react";

import { Sheet } from "../shell/Sheet.jsx";
import { EventForm } from "../settings/EventForm.jsx";

/*
  Edit/delete sheet — now a thin wrapper around the same EventForm Composer
  uses, so an edited event goes through identical field logic to a freshly
  authored one. Only this file's own concerns remain: the sheet chrome and
  the two-step delete confirm.
*/
export function EventDetailSheet({ event, members, settings, onSave, onDelete, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Sheet title="Event" onClose={onClose}>
      <EventForm
        initial={event}
        members={members}
        settings={settings}
        placeholderTitle="Event"
        renderFooter={(draft, canSave) => (
          <div className="fb-sheetfoot">
            {confirmDelete ? (
              <>
                <span className="fb-inlabel fb-deleteprompt">Delete this event?</span>
                <button className="fb-ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
                <button className="fb-primary fb-danger" onClick={onDelete}>
                  Yes, delete
                </button>
              </>
            ) : (
              <>
                <button className="fb-ghost fb-textdanger" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
                <button className="fb-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button className="fb-primary" disabled={!canSave} onClick={() => canSave && onSave(draft)}>
                  Save
                </button>
              </>
            )}
          </div>
        )}
      />
    </Sheet>
  );
}
```

- [ ] **Step 2: Rewrite `EventDetailSheet.test.jsx` for the new UI**

Replace `src/components/views/EventDetailSheet.test.jsx` entirely:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EventDetailSheet } from "./EventDetailSheet.jsx";
import { ModeContext } from "../../state/ModeContext.js";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8" }];
const SETTINGS = { timeFormat: "12" };
const noop = () => {};
const modeState = { mode: "personal", setMode: noop, roster: MEMBERS, calendars: [], views: [], isRoommate: false };

function timedEvent() {
  return {
    id: "e1",
    title: "Standup",
    start: new Date(2026, 2, 15, 9, 0),
    end: new Date(2026, 2, 15, 9, 30),
    allDay: false,
    milestone: false,
    memberIds: ["brian"],
    variant: 0,
    location: "",
    description: "",
  };
}

function multiDayEvent() {
  return {
    id: "e2",
    title: "Kauai",
    start: new Date(2026, 2, 15),
    end: new Date(2026, 2, 18),
    allDay: true,
    milestone: false,
    memberIds: ["brian"],
    variant: 0,
    location: "",
    description: "",
  };
}

function renderSheet(event, onSave = noop, onDelete = noop) {
  return render(
    <ModeContext.Provider value={modeState}>
      <EventDetailSheet
        event={event}
        members={MEMBERS}
        settings={SETTINGS}
        onSave={onSave}
        onDelete={onDelete}
        onClose={noop}
      />
    </ModeContext.Provider>,
  );
}

describe("EventDetailSheet", () => {
  it("pre-fills the title, date and times from the event", () => {
    renderSheet(timedEvent());
    expect(screen.getByPlaceholderText("Add title")).toHaveValue("Standup");
    expect(screen.getByLabelText("Start time")).toHaveTextContent("9a");
    expect(screen.getByLabelText("End time")).toHaveTextContent("9:30a");
  });

  it("reveals the end-date field for an already multi-day all-day event", () => {
    renderSheet(multiDayEvent());
    expect(screen.getByLabelText("End date")).toHaveTextContent("Wednesday, March 18");
  });

  it("saves a timed event switched to All day without moving its start day", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderSheet(timedEvent(), onSave);
    await user.click(screen.getByRole("checkbox", { name: "All day" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const patch = onSave.mock.calls[0][0];
    expect(patch.allDay).toBe(true);
    expect(patch.start).toEqual(new Date(2026, 2, 15));
    expect(patch.end).toEqual(new Date(2026, 2, 15));
  });

  it("delete requires a two-step confirm", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderSheet(timedEvent(), noop, onDelete);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this event?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("a milestone still shows the All day checkbox (unchanged, always-checked-in-effect state) but hides times and the end date", () => {
    const milestone = { ...timedEvent(), allDay: true, milestone: true };
    renderSheet(milestone);
    /* Unlike the pre-redesign EventDetailSheet (which hid "All day" for a
       milestone) and matching Composer's own pre-redesign behavior (which
       never hid it), EventForm renders "All day" unconditionally — a
       milestone forces allDay semantics but the spec only asks to hide the
       time fields and the end-date control, never the checkbox itself. */
    expect(screen.getByRole("checkbox", { name: "All day" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run, fix, confirm pass**

Run: `npm test -- EventDetailSheet.test.jsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/views/EventDetailSheet.jsx src/components/views/EventDetailSheet.test.jsx
git commit -m "Rewrite EventDetailSheet as a thin EventForm wrapper"
```

---

### Task 13: Remove dead scrollbar CSS, full-suite and build verification

**Files:**
- Modify: `src/styles/shell/Sheet.js`

**Interfaces:**
- Consumes: nothing new — this is cleanup once Tasks 11/12 have removed the
  last references to the old hour-pill row.

- [ ] **Step 1: Confirm nothing still renders the dead classes**

Run: `grep -rn "fb-pills-scroll" src/components` (or the Grep tool) —
expected: no matches (Composer.jsx/EventDetailSheet.jsx were rewritten in
Tasks 11-12).

- [ ] **Step 2: Remove the scroll rules from `Sheet.js`**

In `src/styles/shell/Sheet.js`:
- Delete the `.fb-pills-scroll { flex-wrap: nowrap; overflow-x: auto;
  padding-bottom: 4px; }` rule entirely.
- Change `.fb-sheetbody { padding: 20px; overflow-y: auto; display: flex;
  flex-direction: column; gap: 18px; }` to drop `overflow-y: auto`:
  `.fb-sheetbody { padding: 20px; display: flex; flex-direction: column; gap: 18px; }`

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, zero failures across the whole repo.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: builds cleanly with no errors (this catches any stray unused
import or JSX typo the test suite wouldn't).

- [ ] **Step 5: Manual smoke check (if a dev server is available in this environment)**

Run: `npm run dev` and open the app; open "Add event" and confirm:
- No horizontal or vertical scrollbar on the sheet itself.
- Title field reads "Add title".
- Clicking the date opens a month grid; clicking a time opens a 15-minute
  scrollable list (the list itself may scroll); double-clicking a time
  switches to a typable field.
- Picking an end time before the start time reveals a Thursday-the-next-day
  end-date field; picking one after collapses it again.
- All day, People/Shade, Location, Description all still work.

If no browser is available in this environment, skip this step and say so
explicitly rather than claiming it was verified — the automated test suite
and build in Steps 3-4 are what this step cannot replace.

- [ ] **Step 6: Commit**

```bash
git add src/styles/shell/Sheet.js
git commit -m "Remove the event form's old scrollbar CSS, now unused"
```
