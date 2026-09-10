# Add/edit event screen redesign

Date: 2026-09-10

## Goal

Rework the add-event sheet to mirror Google Calendar's own event editor:
title-first, a single robust date/time control instead of separate
day/starts/for pill rows, no scrollbars anywhere except inside the time
picker itself, and two new pieces of surrounding groundwork — a 12h/24h
time-format setting and a `description` field on events.

## 0. Time format setting (prerequisite)

- `settings.timeFormat: "12" | "24"`, default `"12"` (preserves current
  behavior). Added to the `Settings` typedef (`contracts/schema.js`),
  `DEFAULT_SETTINGS` (`contracts/defaults.js`), and `migrateSettings`
  (`contracts/migrate.js`) following the exact pattern `sleepStyle` and
  `weather.units` already use — validated against `["12","24"]`, falls back
  to `"12"`.
- `fmtTime(date, format)` and `fmtClock(date, format)` in `lib/date.js` gain a
  second parameter. 24h mode drops the am/pm suffix and does not wrap hours
  through 12 (`String(h).padStart(2, "0")`). This is app-wide: every call
  site — `Header.jsx`, `WeatherWidget.jsx`, `WeatherRowList.jsx`,
  `WeekView.jsx`, `DayView.jsx`, `AgendaView.jsx`, `TimeGutter.jsx`,
  `Screensaver.jsx`, `SleepVeil.jsx`, and the new event form — passes
  `settings.timeFormat` through. All of these components already receive
  `settings` (directly or via a prop that traces back to it) except where
  noted below; those get the prop threaded through.
- `Settings.jsx` gets a pill toggle ("12-hour" / "24-hour") next to the
  existing `°F`/`°C` units pills, same visual pattern.

## 1. Event schema addition

- Add `description: string` to the `Event` typedef and `normalizeEvent`
  (`contracts/schema.js`), defaulting to `""` exactly like `location`.
- `data/google.js`: `mapGoogleEvent` reads `raw.description || ""`;
  `toGoogleEventBody` writes `body.description = fields.description` when
  present — same shape as the existing `location` handling (lines ~206/218).

## 2. Component structure

`Composer.jsx` (create) and `EventDetailSheet.jsx` (edit/delete) are
unified onto one shared `EventForm.jsx` holding all fields, state, and
save-payload assembly. The two existing files become thin wrappers:

- `Composer.jsx`: renders `<Sheet title="New event">`, passes
  `mode="create"` and an initial draft seeded from `date`/`members[0]`,
  footer is Cancel/Add.
- `EventDetailSheet.jsx`: renders `<Sheet title="Event">`, passes
  `mode="edit"` and the existing `event`, footer is
  Delete/Cancel/Save with the existing two-step delete confirm (unchanged
  from today).

`EventForm` does not know about Sheet, save wiring, or delete — it exposes
`(draft) => void` via `onChange` or is fully controlled by its two callers,
mirroring how `Composer`/`EventDetailSheet` already assemble a payload for
`onSave` today.

## 3. Field layout (top to bottom)

1. **Preview banner** — unchanged: `.fb-preview` showing the blended
   member-shade background and title text.
2. **Title** — `<input placeholder="Add title">` (was "What is it?").
3. **Timing row** — clock icon + date field + start/end time fields. See
   §4.
4. **All day** — checkbox, unchanged behavior, now also toggles the shared
   multi-day end-date control (§4) instead of its own separate "Ends" pill
   row.
5. **Milestone** — "Count down to this on the board" checkbox, directly
   under All day (unchanged semantics: forces `allDay`, single-day only,
   hides the end-date control).
6. **People + Shade** — person icon heading the existing member-pill row
   and shade ramp, unchanged logic (`who`, `variant`, `wontSyncReason`,
   `splitFill`/`variantColor`).
7. **Location** — pin icon + existing text input, unchanged.
8. **Description** — pencil-over-notebook icon + new `<textarea>`.

Collapsing Day/Starts/For/Ends into the single timing row (§4) removes
enough vertical space that the sheet body no longer needs to scroll; see
§6.

## 4. Timing row (the robust part)

State: `startDate`, `startMinutes` (0-1439), `endMinutes` (0-1439),
`endDate`, `endDateTouched` (bool, not persisted — resets each time the
sheet opens).

- **Date field** reads `fmtLongDate(startDate)`-style ("Wednesday,
  September 9"). Click opens `DatePickerPopover`: a month grid with
  prev/next chevrons (reusing `stepAnchor("month", anchor, dir)` from
  `lib/date.js`), today highlighted, selected day marked. Closes on pick or
  outside click.
- **Start/end time fields** render side by side, e.g. "8:00 — 9:00",
  formatted with `fmtClock`/`fmtTime` per `settings.timeFormat`. Click opens
  `TimePickerPopover`: a scrollable list, full 24 hours in 15-minute steps
  (96 rows, 12:00 AM … 11:45 PM or 00:00 … 23:45 depending on format),
  auto-scrolled to the current value on open. This list is the one place in
  the whole sheet allowed a scrollbar.
- **Double-click** either time field to swap it for a free-text input
  (keyboard entry). Accepts flexible formats ("8", "815pm", "20:15", "8:15
  AM"); on blur, an unparseable value reverts to the last valid one.
- **End-time rows show duration**: each row in the end-time picker is
  labeled `8:00 PM (30 mins)`, computed as
  `((entryMinutes - startMinutes + 1440) % 1440)` minutes — always
  non-negative, so a wrap-past-midnight entry shows a large duration
  instead of a negative one.
- **Multi-day auto-detection**, driven by `endDateTouched`:
  - While `endDateTouched` is false: any end-time pick/type where
    `endMinutes <= startMinutes` auto-sets `endDate = startDate + 1 day`
    and reveals the end-date field (a second `DatePickerPopover`,
    defaulting to the day after start). An end-time pick/type where
    `endMinutes > startMinutes` while still untouched auto-collapses
    `endDate` back to `startDate` and hides the field.
  - Opening the end-date popover and picking a date sets
    `endDateTouched = true`. From then on the field stays visible and
    stops auto-collapsing on time changes, so a deliberately multi-day
    timed event (e.g. Mon 9am → Wed 5pm: dial an early end time to reveal
    the field, pick Wednesday, then set 5pm) sticks.
  - **All day** reuses this same end-date field/state rather than a
    separate implementation — checking it just hides both time fields;
    the date-only span logic (`endDate`, `endDateTouched`) is identical to
    the timed case's, and a milestone always collapses it back to
    single-day.
- Save assembles `start`/`end` from `(startDate, startMinutes)` and
  `(endDate ?? startDate, endMinutes)` exactly as today's `start`/`end`
  construction in `Composer.jsx`/`EventDetailSheet.jsx`, just sourced from
  the new fields instead of `day`/`hour`/`dur`/`endDay`.

## 5. Icons

New small inline SVGs in `components/shell/`, matching the existing
line-icon stroke weight used elsewhere in the header/footer chevrons:
clock (timing row), person (people/shade), location pin, pencil-over-
notebook (description).

## 6. Scrollbar removal

- `.fb-sheetbody`'s `overflow-y: auto` (`styles/shell/Sheet.js:35`) is
  removed; the sheet sizes to its (now more compact) content.
- `.fb-pills-scroll`'s `overflow-x: auto` (`styles/shell/Sheet.js:52`) is
  removed along with the hour-pill row it was built for — replaced by the
  timing row's popovers.
- The only scrollable element left anywhere in the add/edit-event flow is
  the list inside `TimePickerPopover`.

## Testing

- `lib/date.js`: `fmtTime`/`fmtClock` with both formats.
- `contracts/migrate.test.js`: `timeFormat` migration/validation, same
  shape as existing `sleepStyle`/`weather.units` cases.
- `EventForm`: multi-day auto-detect/auto-collapse state machine (the
  `endDateTouched` transitions in §4) — the highest-risk logic in this
  spec, worth direct unit coverage independent of the picker UI.
- `data/google.js`: description round-trips read/write.
- Existing `Composer`/`EventDetailSheet` test suites updated for the new
  field structure; delete-confirm and unsynced-member-warning behavior
  unchanged.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
