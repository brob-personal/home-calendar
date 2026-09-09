/*
  ============================================================================
  THE MOCK CALENDAR SOURCE — R3, backlog item 5
  ----------------------------------------------------------------------------
  seedEvents() below is the prototype's, unchanged, and stays that way: it is
  the fixture every view, test and screenshot has been read against, and R8
  keeps it as the offline development path once the Google adapter lands.

  What R3 changed is only the source around it:

    - All five methods now exist. `list`, `create` and `remove` were here;
      `update` and `subscribe` are new, and the mock is the reference
      implementation R8 matches (see ../contracts/source.js for the contract
      and for why those two matter).
    - Everything leaves through normalizeEvent(), so the mock cannot hand a
      view a shape the contract forbids — no missing `location`, no string
      where a Date belongs. That makes it a real test of downstream code
      rather than a source of conveniently perfect objects.

  The Date landmine that used to be flagged here is fixed, but not in this
  file: seedEvents still builds live Dates, exactly as before. What changed is
  that they now survive persistence, via ../contracts/serialize.js.
  ============================================================================
*/
import { uid } from "../lib/uid.js";
import { startOfDay, addDays } from "../lib/date.js";
import { normalizeEvent } from "../contracts/schema.js";
import { defineSource, inRange } from "../contracts/source.js";

function seedEvents() {
  const t = startOfDay(new Date());
  const at = (off, h, m) => {
    const d = addDays(t, off);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const ev = (off, sh, sm, dur, title, members, variant = 0, extra = {}) => ({
    id: uid(),
    title,
    memberIds: members,
    variant,
    start: at(off, sh, sm),
    end: at(off, sh, sm + dur),
    allDay: false,
    milestone: false,
    location: "",
    ...extra,
  });

  return [
    ev(0, 7, 30, 45, "Gym", ["brian"], 3),
    ev(0, 9, 0, 60, "Standup", ["brian"], 1),
    ev(0, 10, 0, 90, "Studio time", ["tatyana"], 2),
    ev(0, 12, 30, 60, "Lunch with Ray", ["rachel"], 5, { location: "Marlow's" }),
    ev(0, 13, 0, 120, "Soccer practice", ["john"], 0),
    ev(0, 15, 0, 90, "Dentist", ["rachel"], 6),
    ev(0, 16, 0, 60, "Piano", ["david"], 2),
    ev(0, 18, 30, 90, "Dinner at the Kims'", ["brian", "rachel"], 0, { location: "Decatur" }),
    ev(1, 8, 0, 30, "School dropoff", ["brian"], 7),
    ev(1, 11, 0, 120, "Design review", ["brian"], 1),
    ev(1, 14, 0, 90, "Tutoring", ["john"], 4),
    ev(1, 17, 0, 60, "Yoga", ["rachel"], 3),
    ev(1, 19, 0, 60, "Robotics club", ["david"], 1),
    ev(2, 9, 30, 60, "Vet, Ollie", ["rachel"], 8),
    ev(2, 13, 0, 180, "Offsite", ["brian"], 1),
    ev(2, 15, 30, 60, "Ballet", ["tatyana"], 4),
    ev(2, 19, 0, 120, "Trivia night", ["brian", "rachel"], 2),
    ev(3, 7, 0, 60, "Long run", ["brian"], 3),
    ev(3, 10, 0, 90, "Orthodontist", ["david"], 6),
    ev(3, 14, 0, 60, "Parent-teacher call", ["brian", "rachel"], 5),
    ev(3, 17, 30, 90, "Swim meet", ["john"], 0),
    ev(4, 10, 0, 90, "Contractor walkthrough", ["brian", "rachel"], 9),
    ev(4, 13, 0, 60, "Art class", ["tatyana"], 2),
    ev(4, 16, 30, 90, "Haircut", ["rachel"], 7),
    ev(5, 9, 0, 240, "Farmers market", ["brian", "rachel"], 10),
    ev(5, 12, 0, 180, "Birthday party", ["david", "john"], 4),
    ev(5, 19, 30, 150, "Movie night", ["brian", "rachel", "david", "john", "tatyana"], 0),
    ev(6, 11, 0, 120, "Brunch with Mom", ["brian", "rachel"], 5),
    ev(8, 13, 0, 60, "Car inspection", ["brian"], 9),
    ev(9, 18, 0, 120, "Book club", ["rachel"], 1),
    ev(12, 9, 0, 60, "Flu shots", ["david", "john", "tatyana"], 6),
    {
      id: uid(),
      title: "Kauai",
      memberIds: ["brian", "rachel"],
      variant: 0,
      start: addDays(t, 41),
      end: addDays(t, 49),
      allDay: true,
      milestone: true,
      location: "",
    },
    {
      id: uid(),
      title: "Anniversary",
      memberIds: ["brian", "rachel"],
      variant: 2,
      start: addDays(t, 16),
      end: addDays(t, 16),
      allDay: true,
      milestone: true,
      location: "",
    },
    {
      id: uid(),
      title: "Tatyana's birthday",
      memberIds: ["tatyana"],
      variant: 0,
      start: addDays(t, 5),
      end: addDays(t, 5),
      allDay: true,
      milestone: true,
      location: "",
    },
    {
      id: uid(),
      title: "Thanksgiving in Ohio",
      memberIds: ["brian", "rachel", "david", "john", "tatyana"],
      variant: 4,
      start: addDays(t, 76),
      end: addDays(t, 80),
      allDay: true,
      milestone: true,
      location: "",
    },
  ];
}

export function createMockSource() {
  let events = seedEvents().map(normalizeEvent);

  /*
    A Set, not an array: unsubscribing is by identity and a listener registered
    twice — which StrictMode's double-invoked effects will do — must not be
    notified twice.
  */
  const listeners = new Set();

  /*
    Notified after the mutation, with the whole list. A diff would be cheaper
    and is not worth it: the board holds a few hundred events at most, and
    "here is the current truth" is a contract a consumer cannot misapply,
    whereas a patch stream is one it can.
  */
  const emit = () => {
    const snapshot = [...events];
    for (const fn of [...listeners]) fn(snapshot);
  };

  return defineSource(
    {
      /* A copy, never the internal array. Handing out the live reference lets
         a caller's `.push()` or `.sort()` rewrite the source's state from the
         outside — silently, and only on the mock, which is precisely the kind
         of difference that makes a mock stop being a valid stand-in. */
      async list(range) {
        return range ? events.filter((e) => inRange(e, range)) : [...events];
      },

      async create(draft) {
        /* The id is the source's to assign, which is why create resolves with
           the stored event rather than echoing the draft. */
        const created = normalizeEvent({ ...draft, id: uid() });
        events = [...events, created];
        emit();
        return created;
      },

      /*
        The method the app has never had. Patch semantics rather than replace:
        R7's detail sheet edits a title or a time and should not have to send
        back fields it never showed. `id` is stripped from the patch so an edit
        cannot silently fork an event into a second one.
      */
      async update(id, patch) {
        const i = events.findIndex((e) => e.id === id);
        if (i === -1) {
          throw new Error(`Cannot update unknown event "${id}".`);
        }
        const { id: _ignored, ...rest } = patch || {};
        const next = normalizeEvent({ ...events[i], ...rest, id });
        events = events.map((e, j) => (j === i ? next : e));
        emit();
        return next;
      },

      /* Idempotent by construction — filter on an absent id is a no-op. A
         wall board double-firing a delete must not raise. */
      async remove(id) {
        const before = events.length;
        events = events.filter((e) => e.id !== id);
        if (events.length !== before) emit();
      },

      subscribe(listener) {
        if (typeof listener !== "function") {
          throw new TypeError("subscribe expects a function.");
        }
        listeners.add(listener);
        /* Safe to call twice: Set.delete on an absent member is a no-op. */
        return () => listeners.delete(listener);
      },
    },
    "mock source",
  );
}
