/*
  The calendar source seam.
  >>> SWAP

  This is the single insertion point for real data. App.jsx calls
  createSource() once, in a useMemo, and never learns which implementation it
  got. PLAN.md §5 rule 5 names this seam as deliberate design to extend rather
  than replace.

  R3 formalized what passes through it (backlog item 5). The interface is now
  five methods — list / create / update / remove / subscribe — declared and
  enforced in ../contracts/source.js. `update` and `subscribe` are the two that
  did not exist; the reasoning for each is in that file, and the mock in
  ./mock.js is the reference implementation.

  For R8, which owns ./google.js: build it with `defineSource()` so a partial
  adapter fails at construction instead of the first time somebody edits an
  event on the wall, and return contract-shaped events — run them through
  `normalizeEvent()` rather than hand-rolling the mapping. The re-exports below
  mean ./google.js imports one module, not three.
*/
import { createMockSource } from "./mock.js";

export { defineSource, inRange, SOURCE_METHODS } from "../contracts/source.js";

/**
 * The board's calendar source.
 *
 * Still unconditional, because there is nothing yet to choose between: R8
 * lands ./google.js behind this call, and the mock stays as the offline
 * development path. When that happens the choice belongs here — one branch, on
 * configuration — and not at any call site.
 *
 * @returns {import("../contracts/source.js").CalendarSource}
 */
export function createSource() {
  return createMockSource();
}

/* ============================================================================
   >>> SWAP — Google Calendar adapter

   Two mappings do the work:

   1. Calendar to people. A shared calendar maps to two ids, and that is what
      produces the diagonal split. R3 moved this map into persisted settings so
      it can be edited on the device and can differ per mode — see
      Settings.calendars and the CalendarLink typedef in ../contracts/schema.js.
      The literal below is what one mode's entry holds.

        const CALENDARS = {
          "brian@gmail.com":                  ["brian"],
          "rachel@gmail.com":                 ["rachel"],
          "family@group.calendar.google.com": ["brian","rachel"],
          "kids@group.calendar.google.com":   ["david","john","tatyana"],
        };

   2. Google's colorId to a shade of the owner's hue. Google numbers its event
      colors 1–11; we pass that straight through as `variant` and let
      variantColor() render it inside the person's own hue. Events with no
      colorId inherit the calendar's colorId, so a whole calendar can sit on
      one shade while individually-colored events break out.

   function createGoogleSource(apiBase) {
     return defineSource({
       async list(range) {
         const r = await fetch(`${apiBase}/events`, { credentials: "include" });
         const raw = await r.json();
         return raw.map(g => {
           const override = (g.extendedProperties?.private?.members || "")
             .split(",").filter(Boolean);
           const colorId = Number(g.colorId || g.calendarColorId || 1);
           return normalizeEvent({
             id: g.id,
             title: g.summary,
             start: g.start.dateTime || g.start.date,
             end:   g.end.dateTime   || g.end.date,
             allDay: !g.start.dateTime,
             location: g.location,
             memberIds: override.length ? override : (CALENDARS[g.organizer?.email] || []),
             variant: (colorId - 1) % VARIATION_COUNT,
             milestone: g.extendedProperties?.private?.milestone === "1",
             calendarId: g.organizer?.email,
             etag: g.etag,
           });
         });
       },
       async create(draft) { ...POST, writing members + milestone to extendedProperties.private... },
       async update(id, patch) { ...PATCH the same fields; `etag` guards the write... },
       async remove(id) { ...DELETE... },
       subscribe(listener) { ...notify on poll, on incremental sync, and on wake... },
     }, "google source");
   }

   Two notes R3 leaves for that work. `normalizeEvent` accepts ISO strings for
   `start`/`end`, so the `new Date(...)` wrappers the sketch used to carry are
   unnecessary — and dropping them removes the place where a malformed payload
   became an Invalid Date nobody checked. And the offline cache item 5 asks for
   is now writable: store.set("events", events) round-trips live Dates through
   ../contracts/serialize.js, which is what Defect #13 was blocked on.

   The OAuth refresh token stays server-side. The iPad never holds a credential.
   ========================================================================== */
