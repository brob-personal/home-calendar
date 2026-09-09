/*
  ============================================================================
  THE GOOGLE CALENDAR SOURCE — R8
  ----------------------------------------------------------------------------
  The design was sketched as a block comment in ./index.js:301-350; this is
  that sketch, built. It implements the same five-method CalendarSource
  contract (../contracts/source.js) as ./mock.js, so App never learns which
  one it has — see createSource() in ./index.js for the one branch that
  chooses.

  What this file owns, concretely:

    1. CALENDAR -> MEMBERS.  A shared calendar maps to two or more member ids,
       which is what makes splitFill() draw its diagonal band. That map lives
       in Settings.calendars, keyed by mode (R3 froze the shape; R10 will
       switch which mode is active). This module never learns members or
       modes any other way — it reads Settings straight out of ../lib/store.js
       on every sync, so a calendar re-pointed in Settings, or a mode switch,
       is picked up on the next poll without this source being recreated.

    2. COLOUR.  Google's colorId (1-11) becomes `variant` via
       `(colorId - 1) % VARIATION_COUNT`, and an event with no colorId of its
       own inherits its calendar's — variantColor() then renders that as a
       shade *within* the owner's hue, never a colour of its own. See
       mapGoogleEvent() below, which is the sketch's mapping unchanged.

    3. WRITE-BACK.  create/update round-trip `memberIds` and `milestone`
       through extendedProperties.private, so the board's own metadata
       survives being edited from Google's own UI and read back.

    4. SYNC.  Each calendar gets its own incremental sync token (Google's, not
       a home-grown one), persisted so a reload resumes instead of re-pulling
       everything. `list()` with no range and the background poll both use it;
       list(range) always does a fresh ranged fetch instead, because a token
       and a time window are mutually exclusive to Google's own API.

    5. DEGRADING.  A dead network or a 401 must not blank the board (PLAN.md
       §1's "no error handling anywhere"). list() never throws: on failure it
       falls back to this session's last good merge, or — on a cold start
       where nothing has synced yet this run — the contract-shaped cache
       useBoardData already persists under STORE_KEYS.events. The array it
       returns in that case carries a non-contract `degraded: true` flag,
       additive and safe to ignore, for whichever failure UI eventually reads
       it (Deferred Defect #7 is still open and is not this role's to close).
  ============================================================================
*/
import { normalizeEvent, clampVariant, VARIATION_COUNT, STORE_KEYS } from "../contracts/schema.js";
import { migrateSettings } from "../contracts/migrate.js";
import { defineSource, inRange } from "../contracts/source.js";
import { store } from "../lib/store.js";

/* Persisted separately from the board's own slices — this is sync plumbing,
   not board data, and STORE_KEYS deliberately does not declare it. Mirrors
   weather.js's own private CACHE_KEY convention. */
const SYNC_TOKENS_KEY = "googleSyncTokens";

/* An always-on display does not need to poll faster than this, and Google's
   own incremental sync is what keeps a 5-minute cadence from feeling stale —
   most ticks cost one cheap "nothing changed" round trip per calendar. */
const POLL_MS = 5 * 60_000;

const DAY_MS = 86_400_000;
/* First sync, before any token exists: wide enough to cover the milestone
   countdown's farthest-out events without pulling a decade of history on
   every cold start. */
const INITIAL_WINDOW = { pastDays: 90, futureDays: 400 };

/**
 * @param {{apiBase?: string, deviceSecret?: string}} [options]
 * @returns {import("../contracts/source.js").CalendarSource}
 */
export function createGoogleSource(options = {}) {
  const apiBase = options.apiBase ?? (import.meta.env.VITE_API_BASE_URL || "");
  const deviceSecret = options.deviceSecret ?? (import.meta.env.VITE_BOARD_DEVICE_SECRET || "");
  const eventsUrl = `${apiBase}/api/calendar/events`;

  /** @type {Set<(events: import("../contracts/schema.js").Event[]) => void>} */
  const listeners = new Set();
  /** @type {Map<string, import("../contracts/schema.js").CalendarLink>} */
  const eventCalendarMap = new Map();
  /** @type {import("../contracts/schema.js").Event[]} */
  let cache = [];
  let pollHandle = null;
  let wakeAttached = false;

  /* ── HTTP ─────────────────────────────────────────────────────────────── */

  async function request(method, { query, body } = {}) {
    const url = new URL(eventsUrl, globalThis.location?.origin ?? "http://localhost");
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
      method,
      headers: {
        "X-Board-Secret": deviceSecret,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!res.ok || !json?.ok) {
      const err = new Error(json?.error || `Calendar API request failed: ${res.status}`);
      err.status = res.status;
      err.code = json?.code;
      throw err;
    }
    return json;
  }

  /* ── Settings.calendars, read fresh on every sync ────────────────────── */

  async function readActiveCalendars() {
    try {
      const raw = await store.get(STORE_KEYS.settings);
      const settings = migrateSettings(raw);
      return (settings.calendars[settings.mode] || []).filter((c) => c.enabled);
    } catch {
      return [];
    }
  }

  /* ── Sync tokens, per calendar, persisted ────────────────────────────── */

  async function readSyncTokens() {
    try {
      return (await store.get(SYNC_TOKENS_KEY)) || {};
    } catch {
      return {};
    }
  }

  async function writeSyncTokens(tokens) {
    try {
      await store.set(SYNC_TOKENS_KEY, tokens);
    } catch {
      /* Best-effort — worst case is one extra full resync next cold start. */
    }
  }

  /* ── Mapping, both directions ─────────────────────────────────────────── */

  function mapGoogleEvent(raw, calendarLink) {
    const membersRaw = raw.extendedProperties?.private?.members;
    const memberIds = membersRaw
      ? membersRaw.split(",").filter(Boolean)
      : (calendarLink?.memberIds ?? []);
    const colorId = Number(raw.colorId || calendarLink?.colorId || 1);

    return normalizeEvent({
      id: raw.id,
      title: raw.summary,
      start: raw.start?.dateTime || raw.start?.date,
      end: raw.end?.dateTime || raw.end?.date,
      allDay: !raw.start?.dateTime,
      location: raw.location || "",
      memberIds,
      variant: (colorId - 1) % VARIATION_COUNT,
      milestone: raw.extendedProperties?.private?.milestone === "1",
      calendarId: calendarLink?.id,
      etag: raw.etag,
    });
  }

  function toGoogleEventBody(fields) {
    const body = {};
    if (fields.title !== undefined) body.summary = fields.title;
    if (fields.location !== undefined) body.location = fields.location;

    if (fields.start !== undefined || fields.end !== undefined || fields.allDay !== undefined) {
      const allDay = Boolean(fields.allDay);
      const start = fields.start instanceof Date ? fields.start : new Date(fields.start);
      const end = fields.end instanceof Date ? fields.end : new Date(fields.end ?? fields.start);
      body.start = allDay ? { date: toDateOnly(start) } : { dateTime: start.toISOString() };
      body.end = allDay ? { date: toDateOnly(end) } : { dateTime: end.toISOString() };
    }

    if (fields.variant !== undefined) {
      body.colorId = String(clampVariant(fields.variant) + 1);
    }

    if (fields.memberIds !== undefined || fields.milestone !== undefined) {
      body.extendedProperties = { private: {} };
      if (fields.memberIds !== undefined) {
        body.extendedProperties.private.members = fields.memberIds.join(",");
      }
      if (fields.milestone !== undefined) {
        body.extendedProperties.private.milestone = fields.milestone ? "1" : "0";
      }
    }

    return body;
  }

  function toDateOnly(d) {
    return d.toISOString().slice(0, 10);
  }

  /* Which calendar a create() targets. Exact membership match first — a
     two-person draft belongs on the calendar that produces exactly that
     diagonal split, not just any calendar that happens to include both.
     Falling back to a superset, then to whatever is first, means a draft
     always lands somewhere rather than failing when Settings.calendars
     doesn't yet have a perfect entry for it. */
  function pickCalendar(calendars, memberIds) {
    if (!calendars.length) {
      throw new Error("No enabled Google calendar is configured for the active mode.");
    }
    const wanted = [...new Set(memberIds)].sort();
    const exact = calendars.find((c) => sameMembers(c.memberIds, wanted));
    if (exact) return exact;
    const superset = calendars.find((c) => memberIds.every((m) => c.memberIds.includes(m)));
    return superset || calendars[0];
  }

  function sameMembers(a, b) {
    const sorted = [...new Set(a)].sort();
    return sorted.length === b.length && sorted.every((v, i) => v === b[i]);
  }

  /* ── Fetching one calendar ────────────────────────────────────────────── */

  async function fetchCalendar(calendarLink, { timeMin, timeMax, useSyncToken }) {
    const tokens = useSyncToken ? await readSyncTokens() : {};
    const syncToken = useSyncToken ? tokens[calendarLink.id] : undefined;

    let data;
    try {
      data = await request("GET", {
        query: syncToken
          ? { calendarId: calendarLink.id, syncToken }
          : { calendarId: calendarLink.id, timeMin, timeMax },
      });
    } catch (err) {
      if (err.code === "SYNC_TOKEN_INVALID") {
        const fresh = await readSyncTokens();
        delete fresh[calendarLink.id];
        await writeSyncTokens(fresh);
        /* useSyncToken stays true: the deleted token already makes the retry
           fall back to a time-window query, and staying "in sync mode" is
           what lets the retry's own nextSyncToken be saved below instead of
           silently dropped. */
        return fetchCalendar(calendarLink, { timeMin, timeMax, useSyncToken });
      }
      throw err;
    }

    if (useSyncToken && data.nextSyncToken) {
      const fresh = await readSyncTokens();
      fresh[calendarLink.id] = data.nextSyncToken;
      await writeSyncTokens(fresh);
    }

    return (data.items || [])
      .filter((raw) => raw.status !== "cancelled")
      .map((raw) => mapGoogleEvent(raw, calendarLink));
  }

  /* ── Merging every enabled calendar ──────────────────────────────────── */

  async function refreshAll({ timeMin, timeMax, useSyncToken }) {
    const calendars = await readActiveCalendars();
    const merged = [];
    let hadFailure = false;

    for (const cal of calendars) {
      try {
        const events = await fetchCalendar(cal, { timeMin, timeMax, useSyncToken });
        for (const e of events) {
          if (e.id) eventCalendarMap.set(e.id, cal);
        }
        merged.push(...events);
      } catch {
        hadFailure = true;
      }
    }

    /* Every configured calendar failed (or none are configured yet) — signal
       "nothing usable this round" so the caller degrades to its own cache
       rather than showing an empty board. */
    if (hadFailure && merged.length === 0 && calendars.length > 0) return null;

    cache = merged;
    return { events: merged, degraded: hadFailure };
  }

  async function readPersistedEventsCache() {
    try {
      const stored = await store.get(STORE_KEYS.events);
      return Array.isArray(stored) ? stored.map(normalizeEvent) : [];
    } catch {
      return [];
    }
  }

  function defaultWindow() {
    return {
      timeMin: new Date(Date.now() - INITIAL_WINDOW.pastDays * DAY_MS).toISOString(),
      timeMax: new Date(Date.now() + INITIAL_WINDOW.futureDays * DAY_MS).toISOString(),
    };
  }

  /* ── The five contract methods ────────────────────────────────────────── */

  async function list(range) {
    const result = range
      ? await refreshAll({
          timeMin: (range.from ?? new Date(0)).toISOString(),
          timeMax: (
            range.to ?? new Date(Date.now() + INITIAL_WINDOW.futureDays * DAY_MS)
          ).toISOString(),
          useSyncToken: false,
        })
      : await refreshAll({ ...defaultWindow(), useSyncToken: true });

    if (result) {
      const events = range ? result.events.filter((e) => inRange(e, range)) : result.events;
      const out = [...events];
      if (result.degraded) out.degraded = true;
      return out;
    }

    const fallback = cache.length ? cache : await readPersistedEventsCache();
    const events = range ? fallback.filter((e) => inRange(e, range)) : fallback;
    const out = [...events];
    out.degraded = true;
    return out;
  }

  async function create(draft) {
    const calendars = await readActiveCalendars();
    const target = pickCalendar(calendars, draft.memberIds || []);

    const { item } = await request("POST", {
      body: { calendarId: target.id, event: toGoogleEventBody(draft) },
    });
    const created = mapGoogleEvent(item, target);
    eventCalendarMap.set(created.id, target);
    cache = upsert(cache, created);
    notify();
    return created;
  }

  async function update(id, patch) {
    const target = eventCalendarMap.get(id);
    if (!target) {
      throw new Error(`Cannot update unknown event "${id}".`);
    }
    const { id: _ignored, ...rest } = patch || {};
    const existing = cache.find((e) => e.id === id);

    const { item } = await request("PATCH", {
      body: {
        calendarId: target.id,
        eventId: id,
        patch: toGoogleEventBody(rest),
        etag: existing?.etag,
      },
    });
    const updated = mapGoogleEvent(item, target);
    cache = upsert(cache, updated);
    notify();
    return updated;
  }

  async function remove(id) {
    const target = eventCalendarMap.get(id);
    if (!target) return; // Idempotent: nothing on this board's side to remove.

    await request("DELETE", { query: { calendarId: target.id, eventId: id } });
    eventCalendarMap.delete(id);
    const before = cache.length;
    cache = cache.filter((e) => e.id !== id);
    if (cache.length !== before) notify();
  }

  function upsert(list, event) {
    const i = list.findIndex((e) => e.id === event.id);
    if (i === -1) return [...list, event];
    const copy = [...list];
    copy[i] = event;
    return copy;
  }

  function notify() {
    const snapshot = [...cache];
    for (const fn of [...listeners]) fn(snapshot);
  }

  /* ── Polling + wake ───────────────────────────────────────────────────── */

  async function poll() {
    const result = await refreshAll({ ...defaultWindow(), useSyncToken: true });
    if (result) notify();
  }

  function onWake() {
    if (document.visibilityState === "visible") poll();
  }

  function attachWake() {
    if (wakeAttached) return;
    wakeAttached = true;
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
  }

  function detachWake() {
    if (!wakeAttached) return;
    wakeAttached = false;
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("focus", onWake);
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("subscribe expects a function.");
    }
    const wasEmpty = listeners.size === 0;
    listeners.add(listener);
    if (wasEmpty) {
      pollHandle = setInterval(poll, POLL_MS);
      attachWake();
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        clearInterval(pollHandle);
        pollHandle = null;
        detachWake();
      }
    };
  }

  return defineSource({ list, create, update, remove, subscribe }, "google source");
}
