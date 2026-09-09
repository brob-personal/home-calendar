import { useState, useEffect, useMemo, useCallback } from "react";

import { store } from "../lib/store.js";
import { dayKey } from "../lib/date.js";
import { createSource } from "../data/index.js";
import { SCHEMA_VERSION, STORE_KEYS } from "../contracts/schema.js";
import { migrate } from "../contracts/migrate.js";
import { DEFAULT_MEMBERS, DEFAULT_SETTINGS } from "../contracts/defaults.js";

/*
  Everything the root component used to own about *data*: the source, the
  persisted slices, the load-once effect, the write-through effects, and
  event/note mutation.

  Carved out of family-board.jsx:425-538 and :620-640 by R2. R3 owns the load
  and persist path through it — PLAN.md §7 Defect #13 is assigned here — and
  changed four things:

    1. **Reads go through migrate().** The load effect used to spread a
       persisted blob over the defaults (`{ ...DEFAULT_SETTINGS, ...s }`) and
       trust it. That fills absent fields and nothing else: a persisted theme
       this build no longer has, a `dayEnd` below `dayStart`, a note with no
       key all arrived intact. migrate() normalizes and clamps as well as
       fills, which is what makes Defect #12 unreachable.

    2. **Events are cached.** They were not persisted at all, because
       JSON.stringify would have flattened their Dates — the second half of
       Defect #13. With ../contracts/serialize.js they survive, so a cold board
       paints the last known events immediately instead of showing an empty
       calendar until source.list() resolves. The source still wins the moment
       it answers.

    3. **Storage failures surface.** store.set no longer swallows; a rejected
       write lands in `storageErrors` and on the console. The bundle exposes
       them so R12's failure UI has something to render — a board that has
       stopped remembering should say so rather than quietly forgetting.

    4. **The source is subscribed to.** `subscribe` is one of the two methods
       R3 added to the interface, and this is its consumer: R8 polls with
       incremental sync tokens and refreshes on wake, and this hook picks that
       up without R8 reaching into React state.

  Effect order is preserved exactly — load, then the write-throughs, then the
  subscription — because the write-through effects are gated on `loaded` and
  the gate has to flip in the load effect first. App.jsx calls this hook
  second, right after useNow, so the interval effect still registers ahead of
  these.

  One hazard still handed on untouched: `source.list()` has no try/catch, so a
  401 or a dead network rejects into an unhandled promise. That is Deferred
  Defect #7, R12's, and it is deliberately still open — what R3 changed is only
  that the board now has cached events to keep showing while it happens.
*/
export function useBoardData(now) {
  const source = useMemo(() => createSource(), []);

  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [storageErrors, setStorageErrors] = useState([]);

  /*
    One entry per (operation, key) pair. A write-through effect that keeps
    failing — a full quota, most likely, on a board that has been on the wall
    for a year — would otherwise append an error on every keystroke in
    Settings and grow without bound on a device that never reloads.
  */
  const reportStorageError = useCallback((err) => {
    console.error(`[board] storage ${err.op ?? "?"} "${err.key ?? "?"}" failed: ${err.message}`);
    setStorageErrors((prev) =>
      prev.some((e) => e.key === err.key && e.op === err.op) ? prev : [...prev, err],
    );
  }, []);

  /* ── Load ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      /*
        Each slice is read independently and a failure on one does not lose the
        others: corrupt notes should not cost you your members. A key that
        throws reads as absent, which migrate() fills from the defaults.
      */
      const keys = [STORE_KEYS.members, STORE_KEYS.settings, STORE_KEYS.notes, STORE_KEYS.events];
      const reads = await Promise.all(
        keys.map(async (key) => {
          try {
            return { key, data: await store.get(key), version: await store.versionOf(key) };
          } catch (err) {
            reportStorageError(err);
            return { key, data: null, version: null };
          }
        }),
      );
      if (!alive) return;

      const persisted = { schemaVersion: lowestVersion(reads) };
      for (const r of reads) {
        if (r.data !== null) persisted[r.key] = r.data;
      }

      const board = migrate(persisted);
      setMembers(board.members);
      setSettings(board.settings);
      setNotes(board.notes);
      /*
        The cache paints only if it has something. Setting an empty array here
        would be indistinguishable from the initial state and would cost a
        render for nothing.
      */
      if (board.events.length) setEvents(board.events);

      const list = await source.list();
      if (!alive) return;
      setEvents(list);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [source, reportStorageError]);

  /* ── Persist ──────────────────────────────────────────────────────────── */
  const persist = useCallback(
    (key, value) => {
      store.set(key, value).catch(reportStorageError);
    },
    [reportStorageError],
  );

  useEffect(() => {
    if (loaded) persist(STORE_KEYS.members, members);
  }, [members, loaded, persist]);
  useEffect(() => {
    if (loaded) persist(STORE_KEYS.settings, settings);
  }, [settings, loaded, persist]);
  useEffect(() => {
    if (loaded) persist(STORE_KEYS.notes, notes);
  }, [notes, loaded, persist]);
  /* New slice — see note 2 in the header. */
  useEffect(() => {
    if (loaded) persist(STORE_KEYS.events, events);
  }, [events, loaded, persist]);

  /* ── Source subscription ──────────────────────────────────────────────── */
  /*
    Registered after the write-through effects so a change arriving during
    mount cannot beat the load effect's own setEvents. The source owns the
    listener list and returns its own teardown.
  */
  useEffect(() => source.subscribe((next) => setEvents(next)), [source]);

  /* ── Events ───────────────────────────────────────────────────────────── */
  /*
    Every mutator below is idempotent against its own result, and that is not
    defensive padding — it is required. A source that emits on mutation (the
    mock does, and R8's will) has already pushed the new list into state by the
    time `await` resolves here, so an unguarded `[...prev, created]` would
    append a second copy of the event that is already there. `update` and
    `remove` are naturally idempotent; `create` needs the id check.

    createEvent is the data half of the root's old `addEvent`. The
    `setPanel(null)` that followed it stays in App.jsx, where the panel state
    lives — same order relative to the await, so the composer still closes only
    after the source has accepted the event.
  */
  const createEvent = async (draft) => {
    const created = await source.create(draft);
    setEvents((prev) => (prev.some((e) => e.id === created.id) ? prev : [...prev, created]));
    return created;
  };

  /*
    The edit path the app has never had. R7's event detail sheet is the first
    consumer; R8 turns it into a PATCH with `memberIds` and `milestone` in
    extendedProperties.private so the board's own metadata round-trips.
  */
  const updateEvent = async (id, patch) => {
    const updated = await source.update(id, patch);
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    return updated;
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
    updateEvent,
    deleteEvent,
    todayKey,
    todayNote,
    saveStrokes,
    /*
      For R12's offline / failure UI. `storageError` is the first failure
      because that is the one worth showing on a wall — a second line of error
      text on a calendar is noise, and the full list is here for the runbook.
    */
    storageErrors,
    storageError: storageErrors[0] ?? null,
  };
}

/*
  The version to migrate *from* is the oldest version any present slice was
  written at, because the three write-through effects persist independently: a
  board interrupted mid-upgrade can hold settings at version 2 and notes at
  version 1, and running the steps from the newer stamp would skip the older
  slice's migration.

  Nothing stored at all means nothing to migrate, which is the first run — so
  the current version, not 0.
*/
function lowestVersion(reads) {
  const versions = reads.filter((r) => r.data !== null && r.version !== null).map((r) => r.version);
  return versions.length ? Math.min(...versions) : SCHEMA_VERSION;
}
