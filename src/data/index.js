/*
  The calendar source seam.
  >>> SWAP

  This is the single insertion point for real data. App.jsx calls
  createSource() once, in a useMemo, and never learns which implementation it
  got. PLAN.md §5 rule 5 names this seam as deliberate design to extend rather
  than replace.

  R3 owns this file next (backlog item 5: formalize the interface as
  list / create / update / remove / subscribe — today only the first three
  exist). R8 adds src/data/google.js behind it. R2 moved the seam and the
  design note below without implementing either.
*/
import { createMockSource } from "./mock.js";

export function createSource() {
  return createMockSource();
}

/* ============================================================================
   >>> SWAP — Google Calendar adapter

   Two mappings do the work:

   1. Calendar to people. A shared calendar maps to two ids, and that is what
      produces the diagonal split.

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
     return {
       async list() {
         const r = await fetch(`${apiBase}/events`, { credentials: "include" });
         const raw = await r.json();
         return raw.map(g => {
           const override = (g.extendedProperties?.private?.members || "")
             .split(",").filter(Boolean);
           const colorId = Number(g.colorId || g.calendarColorId || 1);
           return {
             id: g.id,
             title: g.summary || "Untitled",
             start: new Date(g.start.dateTime || g.start.date),
             end:   new Date(g.end.dateTime   || g.end.date),
             allDay: !g.start.dateTime,
             location: g.location || "",
             memberIds: override.length ? override : (CALENDARS[g.organizer?.email] || []),
             variant: (colorId - 1) % VARIATION_COUNT,
             milestone: g.extendedProperties?.private?.milestone === "1",
           };
         });
       },
       async create(e) { ...POST, writing members + milestone to extendedProperties.private... },
       async remove(id) { ...DELETE... },
     };
   }

   The OAuth refresh token stays server-side. The iPad never holds a credential.
   ========================================================================== */
