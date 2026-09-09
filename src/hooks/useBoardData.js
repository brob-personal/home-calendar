import { useState, useEffect, useMemo } from "react";

import { store } from "../lib/store.js";
import { dayKey } from "../lib/date.js";
import { createSource } from "../data/index.js";
import { DEFAULT_MEMBERS, DEFAULT_SETTINGS } from "../contracts/defaults.js";

/*
  Everything the root component used to own about *data*: the source, the four
  persisted slices, the load-once effect, the three write-through effects, and
  event/note mutation.

  Carved out of family-board.jsx:425-538 and :620-640. The root was holding 11
  state slices plus persistence plus filtering plus colour derivation plus
  sleep plus notes plus event CRUD at once (PLAN.md §R2 item 2). This hook
  takes the data third of that; useMemberFilter and useSleep take the rest.

  Effect order is preserved exactly — load, then members, then settings, then
  notes — because the write-through effects are gated on `loaded` and the
  gate has to flip in the load effect first. App.jsx calls this hook second,
  right after useNow, so the interval effect still registers ahead of these.

  Two hazards handed on untouched:

    - `source.list()` has no try/catch and there is no failure UI, so a 401 or
      a dead network renders a blank board with no explanation. Deferred
      Defect #7, assigned to R12.
    - Events carry live Dates, and store.set JSON-stringifies whatever it is
      given. Notes survive that round-trip because strokes are plain numbers;
      events would not, which is why events are *not* persisted here. R3's
      serializer (backlog item 2) is the prerequisite for caching them.
*/
export function useBoardData(now) {
  const source = useMemo(() => createSource(), []);

  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, s, n] = await Promise.all([
        store.get("members"),
        store.get("settings"),
        store.get("notes"),
      ]);
      if (!alive) return;
      if (m) setMembers(m.map((x) => ({ onBoard: true, ...x })));
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
      if (n) setNotes(n);
      const list = await source.list();
      if (!alive) return;
      setEvents(list);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [source]);

  useEffect(() => {
    if (loaded) store.set("members", members);
  }, [members, loaded]);
  useEffect(() => {
    if (loaded) store.set("settings", settings);
  }, [settings, loaded]);
  useEffect(() => {
    if (loaded) store.set("notes", notes);
  }, [notes, loaded]);

  /* ── Events ───────────────────────────────────────────────────────────── */
  /*
    createEvent is the data half of the root's old `addEvent`. The
    `setPanel(null)` that followed it stays in App.jsx, where the panel state
    lives — same order relative to the await, so the composer still closes
    only after the source has accepted the event.
  */
  const createEvent = async (draft) => {
    const created = await source.create(draft);
    setEvents((prev) => [...prev, created]);
    return created;
  };

  const deleteEvent = async (id) => {
    await source.remove(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  /* ── Notes ────────────────────────────────────────────────────────────── */
  const todayKey = dayKey(now);
  const todayNote = notes.find((n) => n.key === todayKey) || null;

  const saveStrokes = (key, strokes) => {
    setNotes((prev) => {
      const i = prev.findIndex((n) => n.key === key);
      if (strokes.length === 0) return prev.filter((n) => n.key !== key);
      if (i === -1) return [...prev, { key, strokes }];
      const copy = [...prev];
      copy[i] = { ...copy[i], strokes };
      return copy;
    });
  };

  return {
    members,
    setMembers,
    settings,
    setSettings,
    events,
    notes,
    loaded,
    createEvent,
    deleteEvent,
    todayKey,
    todayNote,
    saveStrokes,
  };
}
