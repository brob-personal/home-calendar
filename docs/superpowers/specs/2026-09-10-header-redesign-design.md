# Main screen chrome redesign

Date: 2026-09-10

## Goal

Consolidate all "altering" controls (view switch, member filter, day/week/month
pager, settings) into the top-right of the header, leaving the top-left as
purely static date/weather info. Remove the bottom button row entirely except
for a floating "add event" button.

## Components

- `Header.jsx` — trimmed to the static left zone: weekday, date number,
  month/year, weather widget, clock, "N today" line.
- `HeaderControls.jsx` (new) — right-side cluster: Offline chip (conditional),
  Back-to-today chip (conditional), pager (‹ ›), `ViewSwitcher`,
  `MemberPicker`, gear.
- `ViewSwitcher.jsx` (new) — grey pill showing current view; opens a popover
  listing the other views from the existing mode-derived `views` array.
- `MemberPicker.jsx` (new) — silhouette icon with a badge count of
  `shownMembers.length`; opens a popover checklist built on the existing
  `useMemberFilter` (`isShown`/`toggleMember`/`resetFilter`/`filterTouched`).
  The "Reset" chip lives inside this popover now.
- `PersonProgress.jsx` (new) — small subtle bar + fraction ("2/5") per member:
  `done` = timed events (non-all-day) for that member today whose `end` has
  passed `now`; `total` = timed events for that member today. Purely computed,
  no schema change.
- `Footer.jsx` — deleted.
- `Fab.jsx` (new) — floating "+" button, bottom-right over the stage, wired to
  the same `onCompose` Footer used.

## Behavior per view

- **DayView**: unchanged per-member column headers (avatar + name), each now
  also renders `PersonProgress` for that member.
- **WeekView**: new key/legend row above the grid — one entry per shown
  member (avatar + color + `PersonProgress`) since Week's columns are days,
  not people.
- **MonthView / AgendaView / ChoresView**: unaffected beyond the header/footer
  relocation.

## Data flow

`App.jsx` passes `HeaderControls` what `Footer` used to receive: `view`,
`setView`, `views`, a `page(dir)` callback (via `stepAnchor`), `roster`,
`isShown`, `toggleMember`, `filterTouched`, `resetFilter`, plus `now` and
`filtered` events for `PersonProgress`. `Fab` only needs `onCompose`. No
changes to `useMemberFilter`, `useBoardData`, or the event schema.

## Layout

`.fb-stage` gets a bottom margin so the calendar body stops short of the
screen edge instead of running flush to it; `Fab` floats in that gap,
absolutely positioned within `.fb-board`, and does not overlap calendar
content.

## Testing

- Replace `Footer.test.jsx` with tests for `HeaderControls` / `ViewSwitcher` /
  `MemberPicker` (popover open/close, toggling a member, switching views).
- Extend `DayView.test.jsx` / `WeekView.test.jsx` for the progress bar and
  Week's new key row.
