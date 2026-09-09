/*
  The in-memory mock calendar source — moved verbatim from
  family-board.jsx:352-359 (createMockSource) and :225-299 (seedEvents).

  Two things R3 inherits with this file:

    1. `start`/`end` are live Date objects. seedEvents builds them with
       new Date(), and nothing serializes them. This is the "Date landmine"
       in PLAN.md §1 and R3's backlog item 2.
    2. The source implements three of the five methods R3's item 5
       formalizes: `list`, `create`, `remove`. There is no `update`, and no
       `subscribe`. R2 did not add them — inventing an interface is a
       contract change, which routes through R0.
*/
import { uid } from "../lib/uid.js";
import { startOfDay, addDays } from "../lib/date.js";

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
  let events = seedEvents();
  return {
    async list() {
      return events;
    },
    async create(e) {
      const withId = { ...e, id: uid() };
      events = [...events, withId];
      return withId;
    },
    async remove(id) {
      events = events.filter((e) => e.id !== id);
    },
  };
}
