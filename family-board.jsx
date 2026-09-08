import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ============================================================================
   FAMILY BOARD — wall-mounted calendar for iPad 7th gen (A2197)
   ----------------------------------------------------------------------------
   Canvas is locked to 1080 x 810 CSS px (2160 x 1620 @2x), landscape. The
   <Fit> wrapper scales that canvas to whatever viewport it lands in, so what
   you see here is what the iPad shows. On device the scale resolves to 1.

   Runs with Auto-Lock set to Never. The screen never sleeps at the OS level;
   all dimming, sleeping and screensaver behavior happens in here so the device
   never shows a lock screen and never needs a swipe to reopen.

   Swap points for the real build are marked:  >>> SWAP
   ========================================================================== */

const CANVAS_W = 1080;
const CANVAS_H = 810;

/* ─────────────────────────────────────────────────────────────────────────
   Storage — artifact storage here; swap both bodies for localStorage on your
   own host and nothing else in the app changes.
   >>> SWAP
   ───────────────────────────────────────────────────────────────────────── */
const store = {
  async get(key) {
    try {
      const r = await window.storage.get(`board:${key}`);
      return r ? JSON.parse(r.value) : null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      await window.storage.set(`board:${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable — run from memory */
    }
  },
};

/* ─────────────────────────────────────────────────────────────────────────
   Color
   60% paper, 30% surface grey, 10% the family's pastels.
   ───────────────────────────────────────────────────────────────────────── */
const THEMES = {
  paper: { label: "Paper", paper: "#FCFCFD", surface: "#F0F1F4", line: "#E2E4E9", ink: "#23262D", mute: "#787E8A" },
  cream: { label: "Cream", paper: "#FDFBF6", surface: "#F3EFE6", line: "#E7E1D4", ink: "#2A2721", mute: "#7E7768" },
  mist:  { label: "Mist",  paper: "#FBFCFD", surface: "#EDF1F5", line: "#DEE5EC", ink: "#22282F", mute: "#75808D" },
  sage:  { label: "Sage",  paper: "#FBFCFA", surface: "#EDF2EC", line: "#DFE7DE", ink: "#242A25", mute: "#77827A" },
  blush: { label: "Blush", paper: "#FDFBFC", surface: "#F5EFF1", line: "#EAE0E4", ink: "#2A2427", mute: "#82757B" },
};

const ACCENT_NOW = "#E0574F"; // the current-time line, and nothing else

const MONTH_ART = [
  { name: "January",   art: "radial-gradient(120% 90% at 12% 0%, #CFE0F0 0%, transparent 62%), radial-gradient(95% 75% at 88% 100%, #E4EDF5 0%, transparent 65%), linear-gradient(170deg, #F4F8FC, #E6EEF6)" },
  { name: "February",  art: "radial-gradient(115% 85% at 82% 8%, #DCD4EE 0%, transparent 62%), radial-gradient(100% 78% at 8% 92%, #F0E4EF 0%, transparent 62%), linear-gradient(160deg, #F8F5FC, #EBE4F4)" },
  { name: "March",     art: "radial-gradient(120% 85% at 22% 12%, #D6E8D2 0%, transparent 60%), radial-gradient(92% 72% at 90% 88%, #EDF0DA 0%, transparent 62%), linear-gradient(175deg, #F7FAF4, #E9F1E6)" },
  { name: "April",     art: "radial-gradient(112% 88% at 72% 0%, #CFE6EA 0%, transparent 58%), radial-gradient(100% 76% at 12% 95%, #DCEBD6 0%, transparent 62%), linear-gradient(165deg, #F5FAFA, #E6F1EC)" },
  { name: "May",       art: "radial-gradient(120% 85% at 18% 8%, #D5EAC9 0%, transparent 60%), radial-gradient(95% 75% at 88% 90%, #F3EDC4 0%, transparent 60%), linear-gradient(170deg, #F8FBF2, #EBF3DF)" },
  { name: "June",      art: "radial-gradient(112% 82% at 78% 4%, #FAE9BC 0%, transparent 56%), radial-gradient(100% 80% at 8% 92%, #D8EBCA 0%, transparent 62%), linear-gradient(165deg, #FCF9EC, #EFF4E0)" },
  { name: "July",      art: "radial-gradient(120% 85% at 28% 6%, #FBDDB4 0%, transparent 58%), radial-gradient(92% 72% at 92% 88%, #F8CDB8 0%, transparent 60%), linear-gradient(170deg, #FDF6EC, #F7E7DA)" },
  { name: "August",    art: "radial-gradient(115% 82% at 80% 10%, #F8E3B4 0%, transparent 58%), radial-gradient(100% 78% at 10% 90%, #EFDCC0 0%, transparent 62%), linear-gradient(168deg, #FDF8EC, #F4EADA)" },
  { name: "September", art: "radial-gradient(120% 88% at 20% 8%, #F3D2B6 0%, transparent 58%), radial-gradient(95% 72% at 90% 92%, #EADFC0 0%, transparent 60%), linear-gradient(172deg, #FCF6EF, #F2E7D8)" },
  { name: "October",   art: "radial-gradient(115% 85% at 76% 6%, #F1C4AC 0%, transparent 56%), radial-gradient(100% 80% at 10% 94%, #E7C6C4 0%, transparent 60%), linear-gradient(168deg, #FBF1EC, #F2DFD8)" },
  { name: "November",  art: "radial-gradient(120% 85% at 16% 12%, #E4D6C2 0%, transparent 60%), radial-gradient(92% 72% at 88% 88%, #DCDCE2 0%, transparent 62%), linear-gradient(174deg, #F9F6F1, #ECE8E4)" },
  { name: "December",  art: "radial-gradient(115% 88% at 74% 8%, #CBDCEE 0%, transparent 58%), radial-gradient(100% 78% at 12% 92%, #E2E8EE 0%, transparent 60%), linear-gradient(166deg, #F5F9FC, #E7EDF4)" },
];

const DEFAULT_MEMBERS = [
  { id: "brian",   name: "Brian",   color: "#7EB6E8", photo: "", onBoard: true },
  { id: "rachel",  name: "Rachel",  color: "#F0A3B8", photo: "", onBoard: true },
  { id: "david",   name: "David",   color: "#8ED9B2", photo: "", onBoard: true },
  { id: "john",    name: "John",    color: "#F6C58A", photo: "", onBoard: true },
  { id: "tatyana", name: "Tatyana", color: "#C2A8E8", photo: "", onBoard: true },
];

const DEFAULT_SETTINGS = {
  theme: "paper",
  customPaper: "",
  dayStart: 7,
  dayEnd: 21,
  bedtime: "22:00",
  wakeTime: "06:30",
  sleepDim: 0.05,
  wakeTapSeconds: 90,
  screensaver: true,
  idleMinutes: 6,
  monthArt: true,
  photos: [], // >>> SWAP: image URLs for the photo screensaver
};

/* ─────────────────────────────────────────────────────────────────────────
   Utilities
   ───────────────────────────────────────────────────────────────────────── */
const uid = () =>
  globalThis.crypto?.randomUUID?.() || `id${Math.random().toString(36).slice(2, 10)}`;

function clampHex(h) {
  const s = String(h || "").replace("#", "").slice(0, 6);
  return `#${s.padEnd(6, "0")}`;
}
function toRgb(hex) {
  const h = clampHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
}
function tint(hex, amount) {
  const [r, g, b] = toRgb(hex);
  const m = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}
function initialOf(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

/* ── Sub-colors ──────────────────────────────────────────────────────────
   Google gives every event an optional colorId (1–11). We don't reuse
   Google's actual colors — that would break the person-is-a-color rule.
   Instead each colorId picks a variation *within the owner's hue*, so a
   glance still reads "Brian" while two of Brian's events stay tellable
   apart. Every variation is clamped to the pastel band.
   ──────────────────────────────────────────────────────────────────────── */
function hexToHsl(hex) {
  let [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

/* hue shift (deg), saturation multiplier, lightness delta */
const VARIATIONS = [
  { h: 0, s: 1.0, l: 0.0 },
  { h: -14, s: 1.12, l: -0.08 },
  { h: 13, s: 0.84, l: 0.06 },
  { h: -6, s: 0.68, l: -0.03 },
  { h: 21, s: 1.06, l: -0.05 },
  { h: -23, s: 0.9, l: 0.05 },
  { h: 8, s: 1.18, l: -0.1 },
  { h: -11, s: 0.76, l: 0.08 },
  { h: 27, s: 0.88, l: -0.02 },
  { h: -18, s: 1.1, l: -0.06 },
  { h: 4, s: 0.62, l: 0.03 },
];
const VARIATION_COUNT = VARIATIONS.length;

function variantColor(baseHex, variant = 0) {
  const v = VARIATIONS[((variant % VARIATION_COUNT) + VARIATION_COUNT) % VARIATION_COUNT];
  let [h, s, l] = hexToHsl(baseHex);
  h = (h + v.h + 360) % 360;
  s = Math.min(0.8, Math.max(0.32, s * v.s));
  l = Math.min(0.88, Math.max(0.64, l + v.l));
  return `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
}

/** One color = flat fill. Two or more = hard diagonal split, one band each. */
function splitFill(colors, fallback) {
  const cols = colors.filter(Boolean);
  if (cols.length === 0) return fallback;
  if (cols.length === 1) return cols[0];
  const step = 100 / cols.length;
  const stops = cols.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`).join(", ");
  return `linear-gradient(135deg, ${stops})`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d) {
  const x = startOfDay(d);
  return addDays(x, -x.getDay());
}
function minutesInto(d) {
  return d.getHours() * 60 + d.getMinutes();
}
function daysUntil(d, from) {
  return Math.round((startOfDay(d) - startOfDay(from)) / 86400000);
}
function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTime(d) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, "0")}${ap}` : `${h}${ap}`;
}
function fmtClock(d) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  h = h % 12 || 12;
  return `${h}:${m}`;
}
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ─────────────────────────────────────────────────────────────────────────
   Calendar source
   >>> SWAP
   ───────────────────────────────────────────────────────────────────────── */
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
    { id: uid(), title: "Kauai", memberIds: ["brian", "rachel"], variant: 0, start: addDays(t, 41), end: addDays(t, 49), allDay: true, milestone: true, location: "" },
    { id: uid(), title: "Anniversary", memberIds: ["brian", "rachel"], variant: 2, start: addDays(t, 16), end: addDays(t, 16), allDay: true, milestone: true, location: "" },
    { id: uid(), title: "Tatyana's birthday", memberIds: ["tatyana"], variant: 0, start: addDays(t, 5), end: addDays(t, 5), allDay: true, milestone: true, location: "" },
    { id: uid(), title: "Thanksgiving in Ohio", memberIds: ["brian", "rachel", "david", "john", "tatyana"], variant: 4, start: addDays(t, 76), end: addDays(t, 80), allDay: true, milestone: true, location: "" },
  ];
}

function createMockSource() {
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
             variant: (colorId - 1) % ${VARIATION_COUNT},
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

/* ─────────────────────────────────────────────────────────────────────────
   Hooks
   ───────────────────────────────────────────────────────────────────────── */
function useNow(intervalMs = 20000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function parseHM(s) {
  const [h, m] = String(s).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function isAsleep(now, bedtime, wakeTime) {
  const mins = minutesInto(now);
  const b = parseHM(bedtime);
  const w = parseHM(wakeTime);
  return b > w ? mins >= b || mins < w : mins >= b && mins < w;
}

function useIdle(seconds, enabled) {
  const [idle, setIdle] = useState(false);
  const timer = useRef(null);
  const reset = useCallback(() => {
    setIdle(false);
    clearTimeout(timer.current);
    if (enabled) timer.current = setTimeout(() => setIdle(true), seconds * 1000);
  }, [seconds, enabled]);

  useEffect(() => {
    reset();
    const evs = ["pointerdown", "keydown", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer.current);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [reset]);

  return [idle, reset];
}

/** Scales the fixed 1080x810 canvas to whatever viewport it lands in. */
function Fit({ children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setScale(Math.min(r.width / CANVAS_W, r.height / CANVAS_H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="fb-fit" ref={ref}>
      <div className="fb-device" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Root
   ───────────────────────────────────────────────────────────────────────── */
export default function FamilyBoard() {
  const source = useMemo(() => createMockSource(), []);
  const now = useNow();

  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [view, setView] = useState("day");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [panel, setPanel] = useState(null);
  const [wakeUntil, setWakeUntil] = useState(0);
  const [loaded, setLoaded] = useState(false);

  /* Session filter. null means "use the default set from settings". */
  const [hidden, setHidden] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, s, n] = await Promise.all([store.get("members"), store.get("settings"), store.get("notes")]);
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

  /* ── Visibility ───────────────────────────────────────────────────────── */
  const defaultHidden = useMemo(
    () => members.filter((m) => m.onBoard === false).map((m) => m.id),
    [members]
  );
  const hiddenIds = hidden ?? defaultHidden;
  const isShown = useCallback((id) => !hiddenIds.includes(id), [hiddenIds]);
  const shownMembers = useMemo(() => members.filter((m) => isShown(m.id)), [members, isShown]);
  const filtered = useMemo(
    () => events.filter((e) => (e.memberIds || []).some(isShown)),
    [events, isShown]
  );
  const filterTouched = hidden !== null && hidden.join() !== defaultHidden.join();

  const toggleMember = (id) => {
    const next = hiddenIds.includes(id) ? hiddenIds.filter((x) => x !== id) : [...hiddenIds, id];
    setHidden(next);
  };

  /* ── Sleep / idle ─────────────────────────────────────────────────────── */
  const sleeping = isAsleep(now, settings.bedtime, settings.wakeTime);
  const awakeNow = Date.now() < wakeUntil;
  const dimmed = sleeping && !awakeNow;

  const [idle, resetIdle] = useIdle(
    settings.idleMinutes * 60,
    settings.screensaver && !sleeping && !panel && !noteOpen
  );
  const showSaver = settings.screensaver && idle && !sleeping && !panel && !noteOpen;

  useEffect(() => {
    if (!awakeNow) return;
    const id = setTimeout(() => setWakeUntil(0), wakeUntil - Date.now());
    return () => clearTimeout(id);
  }, [wakeUntil, awakeNow]);

  const theme = THEMES[settings.theme] || THEMES.paper;
  const palette = settings.customPaper ? { ...theme, paper: settings.customPaper } : theme;
  const monthArt = MONTH_ART[now.getMonth()];

  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  /* Only the visible owners contribute bands, so filtering also simplifies
     the split on a shared event. */
  const fillFor = useCallback(
    (e) =>
      splitFill(
        (e.memberIds || [])
          .filter(isShown)
          .map((id) => (byId[id] ? variantColor(byId[id].color, e.variant) : null)),
        palette.surface
      ),
    [byId, palette.surface, isShown]
  );
  const firstColor = useCallback(
    (e) => {
      const id = (e.memberIds || []).find(isShown);
      return id && byId[id] ? variantColor(byId[id].color, e.variant) : palette.mute;
    },
    [byId, palette.mute, isShown]
  );

  const milestones = useMemo(
    () =>
      filtered
        .filter((e) => e.milestone && daysUntil(e.start, now) >= 0)
        .sort((a, b) => a.start - b.start)
        .slice(0, 4),
    [filtered, now]
  );

  const addEvent = async (draft) => {
    const created = await source.create(draft);
    setEvents((prev) => [...prev, created]);
    setPanel(null);
  };
  const deleteEvent = async (id) => {
    await source.remove(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const wake = () => {
    setWakeUntil(Date.now() + settings.wakeTapSeconds * 1000);
    resetIdle();
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

  const cssVars = {
    "--paper": palette.paper,
    "--surface": palette.surface,
    "--line": palette.line,
    "--ink": palette.ink,
    "--mute": palette.mute,
    "--now": ACCENT_NOW,
  };

  return (
    <Fit>
      <style>{CSS}</style>
      <div className="fb-root" style={cssVars}>
        {settings.monthArt && (
          <div className="fb-art" style={{ backgroundImage: monthArt.art }} aria-hidden="true" />
        )}

        <div className="fb-board">
          <Header
            now={now}
            anchor={anchor}
            events={filtered}
            onToday={() => setAnchor(startOfDay(new Date()))}
            onSettings={() => setPanel("settings")}
          />

          {milestones.length > 0 && <Countdowns items={milestones} now={now} color={firstColor} />}

          <main className="fb-stage">
            {view === "day" && (
              <DayView
                date={anchor}
                now={now}
                events={filtered}
                members={shownMembers}
                settings={settings}
                onDelete={deleteEvent}
              />
            )}
            {view === "week" && (
              <WeekView date={anchor} now={now} events={filtered} settings={settings} fill={fillFor} />
            )}
            {view === "month" && (
              <MonthView
                date={anchor}
                now={now}
                events={filtered}
                fill={fillFor}
                onPick={(d) => {
                  setAnchor(d);
                  setView("day");
                }}
              />
            )}
            {view === "agenda" && (
              <AgendaView date={anchor} now={now} events={filtered} members={members} fill={fillFor} />
            )}
          </main>

          <Footer
            view={view}
            setView={setView}
            anchor={anchor}
            setAnchor={setAnchor}
            members={members}
            isShown={isShown}
            onToggleMember={toggleMember}
            showReset={filterTouched}
            onReset={() => setHidden(null)}
            onCompose={() => setPanel("compose")}
          />
        </div>

        <NoteDock
          note={todayNote}
          onOpen={() => setNoteOpen(true)}
          hidden={noteOpen || Boolean(panel)}
        />

        {noteOpen && (
          <NoteWindow
            notes={notes}
            todayKey={todayKey}
            now={now}
            members={members}
            onSave={saveStrokes}
            onClose={() => setNoteOpen(false)}
          />
        )}

        {panel === "compose" && (
          <Composer members={members} date={anchor} onSave={addEvent} onClose={() => setPanel(null)} />
        )}
        {panel === "settings" && (
          <Settings
            settings={settings}
            setSettings={setSettings}
            members={members}
            setMembers={setMembers}
            onClose={() => setPanel(null)}
          />
        )}

        {showSaver && <Screensaver now={now} art={monthArt} photos={settings.photos} events={filtered} />}
        {dimmed && <SleepVeil now={now} opacity={settings.sleepDim} onWake={wake} />}
      </div>
    </Fit>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Avatar
   ───────────────────────────────────────────────────────────────────────── */
function Avatar({ member, size = 40, off = false }) {
  const d = Math.round(size * 0.34);
  return (
    <span className={`fb-av${off ? " is-off" : ""}`} style={{ width: size, height: size }}>
      {member.photo ? (
        <img className="fb-avimg" src={member.photo} alt="" />
      ) : (
        <span
          className="fb-avinit"
          style={{ background: tint(member.color, 0.66), fontSize: Math.round(size * 0.42) }}
        >
          {initialOf(member.name)}
        </span>
      )}
      <span
        className="fb-avdot"
        style={{ width: d, height: d, background: member.color, borderWidth: Math.max(2, size * 0.06) }}
      />
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Header + countdowns
   ───────────────────────────────────────────────────────────────────────── */
function Header({ now, anchor, events, onToday, onSettings }) {
  const isToday = sameDay(anchor, now);
  const todayCount = events.filter((e) => !e.allDay && sameDay(e.start, now)).length;

  return (
    <header className="fb-head">
      <div className="fb-datestack">
        <span className="fb-dow">{DOW_LONG[anchor.getDay()]}</span>
        <span className="fb-num">{anchor.getDate()}</span>
      </div>
      <div className="fb-headmeta">
        <div className="fb-month">
          {MONTH_ART[anchor.getMonth()].name} {anchor.getFullYear()}
        </div>
        <div className="fb-sub">
          {todayCount === 0 ? "Nothing scheduled today" : `${todayCount} today`}
        </div>
      </div>
      <div className="fb-headright">
        <div className="fb-clock">{fmtClock(now)}</div>
        {!isToday && (
          <button className="fb-chip" onClick={onToday}>
            Back to today
          </button>
        )}
        <button className="fb-icon" onClick={onSettings} aria-label="Open settings">
          <Gear />
        </button>
      </div>
    </header>
  );
}

function Countdowns({ items, now, color }) {
  return (
    <div className="fb-countdowns">
      {items.map((e) => {
        const d = daysUntil(e.start, now);
        return (
          <div className="fb-cd" key={e.id}>
            <span className="fb-cdnum" style={{ color: color(e) }}>
              {d === 0 ? "Today" : d}
            </span>
            {d !== 0 && <span className="fb-cdunit">{d === 1 ? "day" : "days"}</span>}
            <span className="fb-cdlabel">{e.title}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Day
   ───────────────────────────────────────────────────────────────────────── */
function DayView({ date, now, events, members, settings, onDelete }) {
  const spanStart = settings.dayStart * 60;
  const spanEnd = settings.dayEnd * 60;
  const span = Math.max(spanEnd - spanStart, 60);

  const timed = events.filter((e) => sameDay(e.start, date) && !e.allDay);
  const allDay = events.filter((e) => sameDay(e.start, date) && e.allDay);

  const ticks = [];
  for (let h = settings.dayStart; h <= settings.dayEnd; h += 2) {
    ticks.push({ h, pct: ((h * 60 - spanStart) / span) * 100 });
  }
  const showNow = sameDay(date, now) && minutesInto(now) >= spanStart && minutesInto(now) <= spanEnd;
  const nowPct = ((minutesInto(now) - spanStart) / span) * 100;

  if (members.length === 0) {
    return <div className="fb-empty">Everyone is hidden. Tap a face below to bring a calendar back.</div>;
  }

  return (
    <div className="fb-day">
      {allDay.length > 0 && (
        <div className="fb-allday">
          {allDay.map((e) => (
            <span key={e.id} className="fb-alldaychip">
              {e.title}
            </span>
          ))}
        </div>
      )}

      <div className="fb-lanes">
        {members.map((m) => {
          const mine = timed.filter((e) => e.memberIds?.includes(m.id));
          return (
            <div className="fb-lane" key={m.id}>
              <div className="fb-lanename">
                <Avatar member={m} size={38} />
                <span className="fb-lanetext">{m.name}</span>
              </div>
              <div className="fb-lanetrack" style={{ background: tint(m.color, 0.88) }}>
                {showNow && <div className="fb-nowline" style={{ left: `${nowPct}%` }} />}
                {mine.length === 0 && <span className="fb-laneempty">Free</span>}
                {mine.map((e) => {
                  const s = Math.max(minutesInto(e.start), spanStart);
                  const en = Math.min(minutesInto(e.end), spanEnd);
                  const shared = (e.memberIds || []).length > 1;
                  return (
                    <button
                      key={e.id}
                      className="fb-block"
                      style={{
                        left: `${((s - spanStart) / span) * 100}%`,
                        width: `${(Math.max(en - s, 22) / span) * 100}%`,
                        background: variantColor(m.color, e.variant),
                      }}
                      onDoubleClick={() => onDelete(e.id)}
                      title="Double-tap to remove"
                    >
                      <span className="fb-blocktitle">{e.title}</span>
                      <span className="fb-blocktime">
                        {fmtTime(e.start)}
                        {shared ? " with family" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fb-axis">
        {ticks.map((t) => (
          <span key={t.h} className="fb-tick" style={{ left: `${t.pct}%` }}>
            {fmtTime(new Date(2000, 0, 1, t.h))}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Week
   ───────────────────────────────────────────────────────────────────────── */
const HOUR_H = 34;

function WeekView({ date, now, events, settings, fill }) {
  const start = startOfWeek(date);
  const hours = [];
  for (let h = settings.dayStart; h < settings.dayEnd; h++) hours.push(h);
  const spanStart = settings.dayStart * 60;
  const spanEnd = settings.dayEnd * 60;
  const gridH = hours.length * HOUR_H;

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const nowTop = ((minutesInto(now) - spanStart) / 60) * HOUR_H;
  const nowVisible = minutesInto(now) >= spanStart && minutesInto(now) <= spanEnd;

  return (
    <div className="fb-week">
      <div className="fb-weekhead">
        <span className="fb-gutter" />
        {days.map((d, i) => (
          <div className={`fb-whead${sameDay(d, now) ? " is-today" : ""}`} key={i}>
            <span className="fb-wdow">{DOW[d.getDay()]}</span>
            <span className="fb-wnum">{d.getDate()}</span>
          </div>
        ))}
      </div>

      <div className="fb-weekbody">
        <div className="fb-weekgrid" style={{ height: gridH }}>
          <div className="fb-gutter fb-hours">
            {hours.map((h) => (
              <span className="fb-hour" style={{ height: HOUR_H }} key={h}>
                {fmtTime(new Date(2000, 0, 1, h))}
              </span>
            ))}
          </div>

          {days.map((d, i) => {
            const today = sameDay(d, now);
            const list = events.filter((e) => sameDay(e.start, d) && !e.allDay);
            return (
              <div className={`fb-wcol${today ? " is-today" : ""}`} key={i}>
                {hours.map((h) => (
                  <div className="fb-hourline" style={{ height: HOUR_H }} key={h} />
                ))}
                {today && nowVisible && (
                  <div className="fb-nowrow" style={{ top: nowTop }}>
                    <span className="fb-nowdot" />
                  </div>
                )}
                {list.map((e) => {
                  const s = Math.max(minutesInto(e.start), spanStart);
                  const en = Math.min(minutesInto(e.end), spanEnd);
                  return (
                    <div
                      key={e.id}
                      className="fb-wblock"
                      style={{
                        top: ((s - spanStart) / 60) * HOUR_H,
                        height: Math.max(((en - s) / 60) * HOUR_H - 2, 18),
                        background: fill(e),
                      }}
                    >
                      <span className="fb-wbtitle">{e.title}</span>
                      <span className="fb-wbtime">{fmtTime(e.start)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Month
   ───────────────────────────────────────────────────────────────────────── */
function MonthView({ date, now, events, fill, onPick }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const cut = cells.findIndex((d, i) => i % 7 === 0 && d > last);
  const visible = cells.slice(0, cut > 0 ? cut : 42);

  return (
    <div className="fb-monthwrap">
      <div className="fb-monthhead">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="fb-grid" style={{ gridTemplateRows: `repeat(${visible.length / 7}, 1fr)` }}>
        {visible.map((d, i) => {
          const outside = d.getMonth() !== date.getMonth();
          const today = sameDay(d, now);
          const list = events.filter((e) => sameDay(e.start, d));
          return (
            <button
              key={i}
              className={`fb-cell${outside ? " is-outside" : ""}${today ? " is-today" : ""}`}
              onClick={() => onPick(d)}
            >
              <span className="fb-cellnum">{d.getDate()}</span>
              <span className="fb-cellevents">
                {list.slice(0, 3).map((e) => (
                  <span key={e.id} className="fb-cellev" style={{ background: fill(e) }}>
                    {e.title}
                  </span>
                ))}
                {list.length > 3 && <span className="fb-cellmore">{list.length - 3} more</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Agenda
   ───────────────────────────────────────────────────────────────────────── */
function AgendaView({ date, now, events, members, fill }) {
  const from = startOfDay(date);
  const upcoming = events.filter((e) => e.start >= from).sort((a, b) => a.start - b.start).slice(0, 40);

  const groups = [];
  upcoming.forEach((e) => {
    const last = groups[groups.length - 1];
    if (last && sameDay(last.day, e.start)) last.items.push(e);
    else groups.push({ day: e.start, items: [e] });
  });

  const who = (e) => (e.memberIds || []).map((id) => members.find((m) => m.id === id)).filter(Boolean);

  if (groups.length === 0) {
    return <div className="fb-empty">Nothing scheduled from here on. Tap New event to add something.</div>;
  }

  return (
    <div className="fb-agenda">
      {groups.map((g, i) => (
        <div className="fb-agroup" key={i}>
          <div className="fb-aday">
            <span className="fb-adow">{sameDay(g.day, now) ? "Today" : DOW[g.day.getDay()]}</span>
            <span className="fb-anum">{g.day.getDate()}</span>
          </div>
          <div className="fb-alist">
            {g.items.map((e) => (
              <div className="fb-arow" key={e.id}>
                <span className="fb-abar" style={{ background: fill(e) }} />
                <span className="fb-atime">{e.allDay ? "All day" : fmtTime(e.start)}</span>
                <span className="fb-atitle">{e.title}</span>
                {e.location && <span className="fb-awhere">{e.location}</span>}
                <span className="fb-awho">
                  {who(e).map((m) => (
                    <Avatar key={m.id} member={m} size={26} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Footer — the legend is also the filter
   ───────────────────────────────────────────────────────────────────────── */
function Footer({ view, setView, anchor, setAnchor, members, isShown, onToggleMember, showReset, onReset, onCompose }) {
  const page = (dir) => {
    if (view === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else setAnchor(addDays(anchor, (view === "week" ? 7 : 1) * dir));
  };

  return (
    <footer className="fb-foot">
      <div className="fb-views">
        {["day", "week", "month", "agenda"].map((v) => (
          <button key={v} className={`fb-view${view === v ? " is-on" : ""}`} onClick={() => setView(v)}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <div className="fb-legend">
        {members.map((m) => {
          const on = isShown(m.id);
          return (
            <button
              key={m.id}
              className={`fb-leg${on ? "" : " is-off"}`}
              onClick={() => onToggleMember(m.id)}
              aria-pressed={on}
              title={on ? `Hide ${m.name}` : `Show ${m.name}`}
            >
              <Avatar member={m} size={30} off={!on} />
              {m.name}
            </button>
          );
        })}
        {showReset && (
          <button className="fb-chip" onClick={onReset}>
            Reset
          </button>
        )}
      </div>

      <div className="fb-pager">
        <button className="fb-icon" onClick={() => page(-1)} aria-label="Previous">
          <Chevron dir="left" />
        </button>
        <button className="fb-icon" onClick={() => page(1)} aria-label="Next">
          <Chevron dir="right" />
        </button>
        <button className="fb-primary" onClick={onCompose}>
          New event
        </button>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Sticky notes
   Strokes are stored as normalized 0–1 points, so a note drawn in the big
   window renders correctly in the little dock thumbnail and would survive a
   change of canvas size.
   ───────────────────────────────────────────────────────────────────────── */
const PENS = ["#23262D", "#E0574F", "#4F8FE0", "#3FA97A", "#D9A32B"];
const NOTE_W = 430;
const NOTE_H = 250;

function drawStrokes(canvas, strokes, w, h) {
  if (!canvas) return;
  const dpr = 2;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  strokes.forEach((s) => {
    if (!s.pts?.length) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.width * (w / NOTE_W));
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * w + 0.4, s.pts[0][1] * h);
    ctx.stroke();
  });
}

/** Read-only render of a note at any size. */
function NoteThumb({ strokes, w, h }) {
  const ref = useRef(null);
  useEffect(() => {
    drawStrokes(ref.current, strokes || [], w, h);
  }, [strokes, w, h]);
  return <canvas ref={ref} style={{ width: w, height: h, display: "block" }} />;
}

/** The always-present bubble, plus a peek at today's note. */
function NoteDock({ note, onOpen, hidden }) {
  if (hidden) return null;
  return (
    <div className="fb-dock">
      {note?.strokes?.length > 0 && (
        <button className="fb-stickypeek" onClick={onOpen} aria-label="Open today's note">
          <NoteThumb strokes={note.strokes} w={150} h={87} />
        </button>
      )}
      <button className="fb-fab" onClick={onOpen} aria-label="Write a note">
        <Pencil />
      </button>
    </div>
  );
}

function NoteWindow({ notes, todayKey, now, onSave, onClose }) {
  const sorted = useMemo(() => [...notes].sort((a, b) => (a.key < b.key ? 1 : -1)), [notes]);
  const keys = useMemo(() => {
    const k = sorted.map((n) => n.key);
    return k.includes(todayKey) ? k : [todayKey, ...k];
  }, [sorted, todayKey]);

  const [index, setIndex] = useState(0);
  const activeKey = keys[index] ?? todayKey;
  const editable = activeKey === todayKey;

  const [strokes, setStrokes] = useState([]);
  const [pen, setPen] = useState(PENS[0]);
  const [width, setWidth] = useState(3);
  const [pos, setPos] = useState({ x: CANVAS_W - NOTE_W - 26, y: CANVAS_H - NOTE_H - 168 });

  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const current = useRef(null);

  /* Load whichever day is being viewed. */
  useEffect(() => {
    setStrokes(notes.find((n) => n.key === activeKey)?.strokes || []);
  }, [activeKey, notes]);

  useEffect(() => {
    drawStrokes(canvasRef.current, strokes, NOTE_W, NOTE_H);
  }, [strokes]);

  const commit = (next) => {
    setStrokes(next);
    if (editable) onSave(todayKey, next);
  };

  const pointFrom = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };

  const onDown = (e) => {
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    current.current = { color: pen, width, pts: [pointFrom(e)] };
    setStrokes((s) => [...s, current.current]);
  };
  const onMove = (e) => {
    if (!drawing.current || !current.current) return;
    current.current.pts.push(pointFrom(e));
    setStrokes((s) => [...s.slice(0, -1), { ...current.current }]);
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    current.current = null;
    setStrokes((s) => {
      if (editable) onSave(todayKey, s);
      return s;
    });
  };

  /* Drag the window by its header, clamped to the board. */
  const dragRef = useRef(null);
  const onDragStart = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const scale = r.width / NOTE_W;
    dragRef.current = { dx: e.clientX, dy: e.clientY, ox: pos.x, oy: pos.y, scale };
  };
  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = d.ox + (e.clientX - d.dx) / d.scale;
    const ny = d.oy + (e.clientY - d.dy) / d.scale;
    setPos({
      x: Math.min(CANVAS_W - NOTE_W - 8, Math.max(8, nx)),
      y: Math.min(CANVAS_H - NOTE_H - 108, Math.max(8, ny)),
    });
  };
  const onDragEnd = () => {
    dragRef.current = null;
  };

  const labelFor = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return sameDay(dt, now) ? "Today" : `${DOW[dt.getDay()]} ${MONTH_SHORT[dt.getMonth()]} ${dt.getDate()}`;
  };

  return (
    <div className="fb-notewrap" style={{ left: pos.x, top: pos.y, width: NOTE_W }}>
      <div
        className="fb-notehead"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <button
          className="fb-notenav"
          onClick={() => setIndex((i) => Math.min(keys.length - 1, i + 1))}
          disabled={index >= keys.length - 1}
          aria-label="Older note"
        >
          <Chevron dir="left" />
        </button>
        <span className="fb-notedate">{labelFor(activeKey)}</span>
        <button
          className="fb-notenav"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="Newer note"
        >
          <Chevron dir="right" />
        </button>
        <button className="fb-noteclose" onClick={onClose} aria-label="Close note">
          <Cross />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className={`fb-notecanvas${editable ? "" : " is-readonly"}`}
        style={{ width: NOTE_W, height: NOTE_H }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <div className="fb-notetools">
        {editable ? (
          <>
            <div className="fb-pens">
              {PENS.map((c) => (
                <button
                  key={c}
                  className={`fb-pen${pen === c ? " is-on" : ""}`}
                  style={{ background: c }}
                  onClick={() => setPen(c)}
                  aria-label="Pen color"
                />
              ))}
            </div>
            <div className="fb-widths">
              {[2, 3, 6].map((w) => (
                <button
                  key={w}
                  className={`fb-width${width === w ? " is-on" : ""}`}
                  onClick={() => setWidth(w)}
                  aria-label={`Stroke ${w}`}
                >
                  <span style={{ width: w * 2 + 4, height: w * 2 + 4, background: "currentColor" }} />
                </button>
              ))}
            </div>
            <button className="fb-noteact" onClick={() => commit(strokes.slice(0, -1))} disabled={!strokes.length}>
              Undo
            </button>
            <button className="fb-noteact" onClick={() => commit([])} disabled={!strokes.length}>
              Clear
            </button>
          </>
        ) : (
          <span className="fb-noteold">Saved note. Go back to today to draw.</span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Composer
   ───────────────────────────────────────────────────────────────────────── */
function Composer({ members, date, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [who, setWho] = useState([members[0]?.id].filter(Boolean));
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(18);
  const [dur, setDur] = useState(60);
  const [variant, setVariant] = useState(0);
  const [milestone, setMilestone] = useState(false);
  const [location, setLocation] = useState("");

  const base = addDays(startOfDay(date), day);
  const start = new Date(base);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + dur * 60000);

  const toggle = (id) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const chosen = who.map((id) => members.find((m) => m.id === id)).filter(Boolean);
  const preview = splitFill(chosen.map((m) => variantColor(m.color, variant)), "var(--surface)");

  return (
    <Sheet title="New event" onClose={onClose}>
      <div className="fb-preview" style={{ background: preview }}>
        {title || "New event"}
      </div>

      <input
        className="fb-input fb-input-lg"
        placeholder="What is it?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <Field label="Who">
        <div className="fb-pills">
          {members.map((m) => (
            <button
              key={m.id}
              className={`fb-avpill${who.includes(m.id) ? " is-on" : ""}`}
              style={who.includes(m.id) ? { background: tint(m.color, 0.74), borderColor: m.color } : undefined}
              onClick={() => toggle(m.id)}
            >
              <Avatar member={m} size={28} />
              {m.name}
            </button>
          ))}
        </div>
      </Field>

      {chosen.length > 0 && (
        <Field label="Shade">
          <div className="fb-ramp">
            {Array.from({ length: VARIATION_COUNT }, (_, i) => (
              <button
                key={i}
                className={`fb-shade${variant === i ? " is-on" : ""}`}
                style={{ background: splitFill(chosen.map((m) => variantColor(m.color, i)), "var(--surface)") }}
                onClick={() => setVariant(i)}
                aria-label={`Shade ${i + 1}`}
              />
            ))}
          </div>
        </Field>
      )}

      <Field label="Day">
        <div className="fb-pills">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(startOfDay(date), i);
            return (
              <button key={i} className={`fb-pill${day === i ? " is-on" : ""}`} onClick={() => setDay(i)}>
                {i === 0 ? "That day" : `${DOW[d.getDay()]} ${d.getDate()}`}
              </button>
            );
          })}
        </div>
      </Field>

      {!milestone && (
        <>
          <Field label="Starts">
            <div className="fb-pills fb-pills-scroll">
              {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                <button key={h} className={`fb-pill${hour === h ? " is-on" : ""}`} onClick={() => setHour(h)}>
                  {fmtTime(new Date(2000, 0, 1, h))}
                </button>
              ))}
            </div>
          </Field>
          <Field label="For">
            <div className="fb-pills">
              {[30, 60, 90, 120, 180, 240].map((d) => (
                <button key={d} className={`fb-pill${dur === d ? " is-on" : ""}`} onClick={() => setDur(d)}>
                  {d < 60 ? `${d}m` : `${d / 60}h`}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}

      <input
        className="fb-input"
        placeholder="Where (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <label className="fb-check">
        <input type="checkbox" checked={milestone} onChange={(e) => setMilestone(e.target.checked)} />
        <span>Count down to this on the board</span>
      </label>

      <div className="fb-sheetfoot">
        <button className="fb-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="fb-primary"
          disabled={!title.trim()}
          onClick={() =>
            title.trim() &&
            onSave({
              title: title.trim(),
              memberIds: who,
              variant,
              start,
              end,
              allDay: milestone,
              milestone,
              location: location.trim(),
            })
          }
        >
          Add event
        </button>
      </div>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Settings
   ───────────────────────────────────────────────────────────────────────── */
function Settings({ settings, setSettings, members, setMembers, onClose }) {
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setMember = (id, patch) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  return (
    <Sheet title="Board settings" onClose={onClose} wide>
      <Field label="Family">
        <div className="fb-members">
          {members.map((m) => (
            <div className="fb-memberblock" key={m.id}>
              <div className="fb-memberrow">
                <Avatar member={m} size={44} />
                <input
                  className="fb-input fb-input-sm"
                  value={m.name}
                  onChange={(e) => setMember(m.id, { name: e.target.value })}
                  placeholder="Name"
                />
                <input
                  type="color"
                  className="fb-swatch"
                  value={clampHex(m.color)}
                  onChange={(e) => setMember(m.id, { color: e.target.value })}
                  aria-label={`Color for ${m.name}`}
                />
                <input
                  className="fb-input fb-input-hex"
                  value={m.color}
                  onChange={(e) =>
                    setMember(m.id, {
                      color: e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`,
                    })
                  }
                  spellCheck="false"
                />
                <input
                  className="fb-input fb-input-sm"
                  value={m.photo}
                  onChange={(e) => setMember(m.id, { photo: e.target.value })}
                  placeholder="Photo URL"
                />
                {members.length > 1 && (
                  <button
                    className="fb-ghost fb-ghost-sm"
                    onClick={() => setMembers((ms) => ms.filter((x) => x.id !== m.id))}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="fb-memberfoot">
                <label className="fb-check fb-check-sm">
                  <input
                    type="checkbox"
                    checked={m.onBoard !== false}
                    onChange={(e) => setMember(m.id, { onBoard: e.target.checked })}
                  />
                  <span>On the board by default</span>
                </label>
                <div className="fb-ramp fb-ramp-sm">
                  {Array.from({ length: VARIATION_COUNT }, (_, i) => (
                    <span key={i} className="fb-shade" style={{ background: variantColor(m.color, i) }} />
                  ))}
                </div>
              </div>
            </div>
          ))}
          <button
            className="fb-ghost"
            onClick={() =>
              setMembers((ms) => [...ms, { id: uid(), name: "New person", color: "#A8D8D0", photo: "", onBoard: true }])
            }
          >
            Add person
          </button>
        </div>
        <p className="fb-note">
          The strip beside each name is that person's eleven shades. Google's event colors 1 to 11 land on
          these, so two of Brian's events can look different without either of them stopping looking like Brian.
        </p>
      </Field>

      <Field label="Board color">
        <div className="fb-pills">
          {Object.entries(THEMES).map(([k, t]) => (
            <button
              key={k}
              className={`fb-pill${settings.theme === k && !settings.customPaper ? " is-on" : ""}`}
              onClick={() => setSettings((s) => ({ ...s, theme: k, customPaper: "" }))}
            >
              <span className="fb-dot" style={{ background: t.paper, border: `1px solid ${t.line}` }} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="fb-hexrow">
          <input
            type="color"
            className="fb-swatch"
            value={clampHex(settings.customPaper || THEMES[settings.theme].paper)}
            onChange={(e) => set("customPaper", e.target.value)}
            aria-label="Custom background color"
          />
          <input
            className="fb-input fb-input-hex"
            placeholder="#FCFCFD"
            value={settings.customPaper}
            onChange={(e) => set("customPaper", e.target.value)}
            spellCheck="false"
          />
          {settings.customPaper && (
            <button className="fb-ghost fb-ghost-sm" onClick={() => set("customPaper", "")}>
              Use preset
            </button>
          )}
        </div>
      </Field>

      <Field label="Sleep">
        <div className="fb-inline">
          <span className="fb-inlabel">Dim at</span>
          <input className="fb-input fb-input-sm" type="time" value={settings.bedtime} onChange={(e) => set("bedtime", e.target.value)} />
          <span className="fb-inlabel">Wake at</span>
          <input className="fb-input fb-input-sm" type="time" value={settings.wakeTime} onChange={(e) => set("wakeTime", e.target.value)} />
        </div>
        <div className="fb-inline">
          <span className="fb-inlabel">Brightness while asleep</span>
          <input type="range" min="0" max="0.4" step="0.02" value={settings.sleepDim} onChange={(e) => set("sleepDim", Number(e.target.value))} />
          <span className="fb-inval">{Math.round(settings.sleepDim * 100)}%</span>
        </div>
        <p className="fb-note">
          A tap brings the board back for {settings.wakeTapSeconds} seconds, then it dims again. The iPad
          never locks, so there is no swipe and no passcode.
        </p>
      </Field>

      <Field label="Idle">
        <label className="fb-check">
          <input type="checkbox" checked={settings.screensaver} onChange={(e) => set("screensaver", e.target.checked)} />
          <span>Show the photo screen when nobody has touched the board</span>
        </label>
        <div className="fb-inline">
          <span className="fb-inlabel">After</span>
          <input className="fb-input fb-input-sm" type="number" min="1" max="60" value={settings.idleMinutes} onChange={(e) => set("idleMinutes", Number(e.target.value))} />
          <span className="fb-inlabel">minutes</span>
        </div>
        <label className="fb-check">
          <input type="checkbox" checked={settings.monthArt} onChange={(e) => set("monthArt", e.target.checked)} />
          <span>Tint the board with this month's artwork</span>
        </label>
      </Field>

      <Field label="Hours shown on the day and week views">
        <div className="fb-inline">
          <input className="fb-input fb-input-sm" type="number" min="0" max="12" value={settings.dayStart} onChange={(e) => set("dayStart", Number(e.target.value))} />
          <span className="fb-inlabel">to</span>
          <input className="fb-input fb-input-sm" type="number" min="13" max="24" value={settings.dayEnd} onChange={(e) => set("dayEnd", Number(e.target.value))} />
        </div>
      </Field>

      <div className="fb-sheetfoot">
        <button className="fb-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Sleep + screensaver
   ───────────────────────────────────────────────────────────────────────── */
function SleepVeil({ now, opacity, onWake }) {
  return (
    <button className="fb-veil" onClick={onWake} aria-label="Wake the board">
      <div className="fb-veilinner" style={{ opacity: Math.max(opacity, 0.02) }}>
        <span className="fb-veilclock">{fmtClock(now)}</span>
        <span className="fb-veildate">
          {DOW[now.getDay()]} {now.getDate()}
        </span>
      </div>
    </button>
  );
}

function Screensaver({ now, art, photos, events }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!photos?.length) return;
    const id = setInterval(() => setI((n) => (n + 1) % photos.length), 30000);
    return () => clearInterval(id);
  }, [photos]);

  const next = events.filter((e) => e.start > now && !e.allDay).sort((a, b) => a.start - b.start)[0];
  const hasPhoto = Boolean(photos?.length);
  const bg = hasPhoto
    ? { backgroundImage: `url(${photos[i]})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundImage: art.art };

  return (
    <div className={`fb-saver${hasPhoto ? " has-photo" : ""}`} style={bg}>
      {hasPhoto && <div className="fb-saverscrim" />}
      <div className="fb-savertext">
        <span className="fb-saverclock">{fmtClock(now)}</span>
        <span className="fb-saverdate">
          {DOW_LONG[now.getDay()]}, {art.name} {now.getDate()}
        </span>
        {next && (
          <span className="fb-savernext">
            Next up is {next.title} at {fmtTime(next.start)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Shared pieces
   ───────────────────────────────────────────────────────────────────────── */
function Sheet({ title, children, onClose, wide }) {
  return (
    <div className="fb-scrim" onClick={onClose}>
      <div className={`fb-sheet${wide ? " is-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="fb-sheethead">
          <h2>{title}</h2>
          <button className="fb-icon" onClick={onClose} aria-label="Close">
            <Cross />
          </button>
        </div>
        <div className="fb-sheetbody">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="fb-field">
      <div className="fb-fieldlabel">{label}</div>
      {children}
    </div>
  );
}

const Gear = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2 5.4 5.4" />
  </svg>
);
const Cross = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const Chevron = ({ dir }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);
const Pencil = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
    <path d="M14.5 6.5l3 3" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────────────────
   Styles — every size below is for the 1080 x 810 canvas
   ───────────────────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');

.fb-fit {
  width: 100%; height: 100vh; min-height: 380px;
  display: grid; place-items: center;
  background: #D9DBE0; overflow: hidden;
}
.fb-device {
  width: ${CANVAS_W}px; height: ${CANVAS_H}px; flex: none;
  transform-origin: center center;
  box-shadow: 0 10px 40px rgba(20,24,32,.18);
  border-radius: 4px; overflow: hidden;
}

.fb-root {
  position: relative; width: 100%; height: 100%;
  background: var(--paper); color: var(--ink);
  font-family: Archivo, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  user-select: none; overflow: hidden;
}
.fb-root *, .fb-root *::before, .fb-root *::after { box-sizing: border-box; }
.fb-root button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; }
.fb-root button:disabled { opacity: .3; cursor: default; }
.fb-root button:focus-visible, .fb-root input:focus-visible {
  outline: 2px solid var(--ink); outline-offset: 2px;
}

.fb-art { position: absolute; inset: 0; opacity: .5; pointer-events: none; }

.fb-board {
  position: relative; display: flex; flex-direction: column;
  height: 100%; padding: 22px 24px 18px; gap: 14px;
}

/* Header — 92px */
.fb-head { display: flex; align-items: flex-end; gap: 20px; height: 92px; flex: none; }
.fb-datestack { display: flex; align-items: baseline; gap: 13px; }
.fb-dow { font-size: 27px; font-weight: 500; letter-spacing: -.015em; color: var(--mute); }
.fb-num { font-size: 82px; font-weight: 800; line-height: .82; letter-spacing: -.045em; }
.fb-headmeta { padding-bottom: 5px; }
.fb-month { font-size: 19px; font-weight: 600; letter-spacing: -.012em; }
.fb-sub { font-size: 14px; color: var(--mute); margin-top: 2px; }
.fb-headright { margin-left: auto; display: flex; align-items: center; gap: 12px; padding-bottom: 5px; }
.fb-clock { font-size: 32px; font-weight: 700; letter-spacing: -.035em; font-variant-numeric: tabular-nums; }
.fb-chip {
  font-size: 13px; font-weight: 600; padding: 8px 14px;
  background: var(--surface); border-radius: 999px; color: var(--mute);
}
.fb-icon {
  display: grid; place-items: center; width: 42px; height: 42px;
  border-radius: 11px; color: var(--mute); background: var(--surface);
}

/* Countdowns — 46px */
.fb-countdowns { display: flex; gap: 30px; align-items: baseline; height: 46px; flex: none; }
.fb-cd { display: flex; align-items: baseline; gap: 6px; }
.fb-cdnum { font-size: 28px; font-weight: 800; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.fb-cdunit { font-size: 13px; color: var(--mute); }
.fb-cdlabel { font-size: 15px; font-weight: 500; }

.fb-stage { flex: 1; min-height: 0; }

/* Day */
.fb-day { display: flex; flex-direction: column; gap: 10px; height: 100%; }
.fb-allday { display: flex; gap: 8px; flex-wrap: wrap; flex: none; }
.fb-alldaychip {
  font-size: 13px; font-weight: 600; padding: 6px 12px;
  background: var(--surface); border-radius: 8px; color: var(--mute);
}
.fb-lanes { flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.fb-lane { display: flex; align-items: stretch; gap: 14px; flex: 1; min-height: 0; }
.fb-lanename { width: 150px; flex: none; display: flex; align-items: center; gap: 11px; }
.fb-lanetext { font-size: 17px; font-weight: 600; letter-spacing: -.015em; }
.fb-lanetrack { position: relative; flex: 1; border-radius: 10px; }
.fb-laneempty {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  font-size: 13px; font-weight: 500; color: var(--mute); opacity: .75;
}
.fb-block {
  position: absolute; top: 5px; bottom: 5px; min-width: 38px;
  border-radius: 8px; padding: 0 11px;
  display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
  color: #24262B; overflow: hidden; text-align: left;
}
.fb-blocktitle {
  font-size: 15px; font-weight: 700; letter-spacing: -.015em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}
.fb-blocktime { font-size: 11px; font-weight: 600; opacity: .66; }
.fb-nowline {
  position: absolute; top: 0; bottom: 0; width: 2px; border-radius: 2px;
  background: var(--now); z-index: 3; pointer-events: none;
}
.fb-axis { position: relative; height: 18px; margin-left: 164px; flex: none; }
.fb-tick {
  position: absolute; transform: translateX(-50%);
  font-size: 12px; font-weight: 600; color: var(--mute); font-variant-numeric: tabular-nums;
}

/* Week */
.fb-week { display: flex; flex-direction: column; height: 100%; }
.fb-weekhead { display: flex; flex: none; padding-right: 6px; }
.fb-gutter { width: 56px; flex: none; }
.fb-whead {
  flex: 1; display: flex; align-items: baseline; justify-content: center; gap: 6px;
  padding: 2px 0 8px; color: var(--mute); border-bottom: 1px solid var(--line);
}
.fb-whead.is-today { color: var(--ink); border-bottom: 2px solid var(--now); }
.fb-wdow { font-size: 13px; font-weight: 600; }
.fb-wnum { font-size: 21px; font-weight: 700; letter-spacing: -.035em; }
.fb-weekbody { flex: 1; overflow-y: auto; overflow-x: hidden; }
.fb-weekgrid { display: flex; position: relative; }
.fb-hours { display: flex; flex-direction: column; }
.fb-hour {
  display: flex; align-items: flex-start; justify-content: flex-end;
  padding-right: 9px; font-size: 12px; font-weight: 600; color: var(--mute);
  font-variant-numeric: tabular-nums; transform: translateY(-6px);
}
.fb-wcol { position: relative; flex: 1; border-left: 1px solid var(--line); }
.fb-wcol:last-child { border-right: 1px solid var(--line); }
.fb-wcol.is-today { background: var(--surface); }
.fb-hourline { border-bottom: 1px solid var(--line); }
.fb-nowrow {
  position: absolute; left: 0; right: 0; height: 2px;
  background: var(--now); z-index: 4; pointer-events: none;
}
.fb-nowdot {
  position: absolute; left: -4px; top: -3px;
  width: 8px; height: 8px; border-radius: 50%; background: var(--now);
}
.fb-wblock {
  position: absolute; left: 2px; right: 2px; z-index: 2;
  border-radius: 6px; padding: 3px 6px; overflow: hidden;
  display: flex; flex-direction: column; color: #24262B;
}
.fb-wbtitle {
  font-size: 12px; font-weight: 700; letter-spacing: -.012em; line-height: 1.15;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fb-wbtime { font-size: 10px; font-weight: 600; opacity: .64; }

/* Month */
.fb-monthwrap { display: flex; flex-direction: column; height: 100%; gap: 7px; }
.fb-monthhead {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--mute); padding: 0 6px;
}
.fb-grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; min-height: 0; }
.fb-cell {
  background: var(--surface); border-radius: 9px;
  padding: 6px 7px; display: flex; flex-direction: column; gap: 4px;
  text-align: left; overflow: hidden;
}
.fb-cell.is-outside { opacity: .42; }
.fb-cell.is-today { box-shadow: inset 0 0 0 2px var(--now); }
.fb-cellnum { font-size: 15px; font-weight: 700; letter-spacing: -.025em; }
.fb-cellevents { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.fb-cellev {
  font-size: 11px; font-weight: 600; color: #24262B;
  padding: 2px 6px; border-radius: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fb-cellmore { font-size: 10px; font-weight: 600; color: var(--mute); padding-left: 2px; }

/* Agenda */
.fb-agenda { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
.fb-agroup { display: flex; gap: 20px; }
.fb-aday { width: 86px; flex: none; display: flex; align-items: baseline; gap: 8px; }
.fb-adow { font-size: 13px; font-weight: 600; color: var(--mute); }
.fb-anum { font-size: 28px; font-weight: 800; letter-spacing: -.04em; }
.fb-alist { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.fb-arow { display: flex; align-items: center; gap: 13px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.fb-abar { width: 6px; height: 26px; border-radius: 3px; flex: none; }
.fb-atime { width: 70px; flex: none; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fb-atitle { font-size: 16px; font-weight: 500; }
.fb-awhere { font-size: 13px; color: var(--mute); }
.fb-awho { margin-left: auto; display: flex; gap: 5px; }
.fb-empty { padding: 40px 0; font-size: 16px; color: var(--mute); }

/* Footer — 60px */
.fb-foot { display: flex; align-items: center; gap: 18px; height: 60px; flex: none; }
.fb-views { display: flex; gap: 4px; background: var(--surface); border-radius: 12px; padding: 4px; }
.fb-view { font-size: 14px; font-weight: 600; padding: 9px 16px; border-radius: 9px; color: var(--mute); }
.fb-view.is-on { background: var(--paper); color: var(--ink); box-shadow: 0 1px 3px rgba(30,34,42,.1); }
.fb-legend { display: flex; gap: 6px; margin: 0 auto; align-items: center; }
.fb-leg {
  display: flex; align-items: center; gap: 7px;
  font-size: 13px; font-weight: 600; color: var(--ink);
  padding: 5px 12px 5px 6px; border-radius: 999px; background: var(--surface);
}
.fb-leg.is-off { color: var(--mute); background: none; }
.fb-pager { display: flex; align-items: center; gap: 8px; }
.fb-primary {
  font-size: 14px; font-weight: 700; padding: 12px 20px;
  border-radius: 11px; background: var(--ink); color: var(--paper);
}

/* Avatar */
.fb-av { position: relative; display: inline-block; flex: none; transition: opacity .15s ease, filter .15s ease; }
.fb-av.is-off { opacity: .38; filter: grayscale(1); }
.fb-avimg, .fb-avinit {
  width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center;
  object-fit: cover; font-weight: 700; letter-spacing: -.01em; color: #24262B;
}
.fb-avdot {
  position: absolute; right: -1px; bottom: -1px;
  border-radius: 50%; border-style: solid; border-color: var(--paper);
}

/* Sticky notes */
.fb-dock {
  position: absolute; right: 24px; bottom: 92px; z-index: 30;
  display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
}
.fb-stickypeek {
  padding: 8px; border-radius: 12px; overflow: hidden;
  background: #FFF8D6; box-shadow: 0 4px 16px rgba(30,34,42,.16);
  transform: rotate(-1.4deg);
}
.fb-fab {
  width: 56px; height: 56px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--ink); color: var(--paper);
  box-shadow: 0 6px 20px rgba(30,34,42,.24);
}
.fb-notewrap {
  position: absolute; z-index: 45;
  background: #FFF8D6; border-radius: 14px; overflow: hidden;
  box-shadow: 0 18px 50px rgba(30,34,42,.3);
  color: #2A2620;
}
.fb-notehead {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; background: #F5EDC4; cursor: grab; touch-action: none;
}
.fb-notehead:active { cursor: grabbing; }
.fb-notedate { flex: 1; text-align: center; font-size: 14px; font-weight: 700; }
.fb-notenav, .fb-noteclose {
  display: grid; place-items: center; width: 30px; height: 30px;
  border-radius: 8px; color: #6B6250;
}
.fb-notecanvas { display: block; touch-action: none; cursor: crosshair; }
.fb-notecanvas.is-readonly { cursor: default; opacity: .9; }
.fb-notetools {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 11px; background: #F5EDC4;
}
.fb-pens { display: flex; gap: 6px; }
.fb-pen { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; }
.fb-pen.is-on { border-color: #2A2620; }
.fb-widths { display: flex; gap: 4px; color: #2A2620; }
.fb-width { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; opacity: .45; }
.fb-width.is-on { opacity: 1; background: rgba(0,0,0,.07); }
.fb-width span { display: block; border-radius: 50%; }
.fb-noteact {
  margin-left: auto; font-size: 12px; font-weight: 700; color: #6B6250;
  padding: 6px 10px; border-radius: 8px;
}
.fb-noteact + .fb-noteact { margin-left: 0; }
.fb-noteold { font-size: 12px; font-weight: 600; color: #6B6250; }

/* Sheets */
.fb-scrim {
  position: absolute; inset: 0; z-index: 40;
  background: rgba(28,32,40,.32); backdrop-filter: blur(3px);
  display: grid; place-items: center; padding: 26px;
}
.fb-sheet {
  width: 560px; max-height: 100%;
  background: var(--paper); border-radius: 18px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 20px 60px rgba(24,28,36,.24);
}
.fb-sheet.is-wide { width: 900px; }
.fb-sheethead {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid var(--line);
}
.fb-sheethead h2 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -.025em; }
.fb-sheetbody { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
.fb-sheetfoot { display: flex; justify-content: flex-end; gap: 10px; padding-top: 2px; }

.fb-preview { border-radius: 10px; padding: 16px 18px; font-size: 17px; font-weight: 700; color: #24262B; }
.fb-field { display: flex; flex-direction: column; gap: 9px; }
.fb-fieldlabel { font-size: 12px; font-weight: 700; color: var(--mute); }
.fb-input {
  background: var(--surface); border: 1px solid transparent; border-radius: 10px;
  padding: 11px 13px; font-size: 15px; color: var(--ink); width: 100%;
}
.fb-input::placeholder { color: var(--mute); }
.fb-input:focus { border-color: var(--line); background: var(--paper); }
.fb-input-lg { font-size: 21px; font-weight: 600; padding: 14px 16px; }
.fb-input-sm { width: auto; min-width: 108px; padding: 9px 11px; font-size: 14px; }
.fb-input-hex { width: 96px; min-width: 0; font-size: 13px; font-variant-numeric: tabular-nums; }

.fb-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.fb-pills-scroll { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
.fb-pill {
  font-size: 14px; font-weight: 600; padding: 10px 15px; white-space: nowrap;
  background: var(--surface); border: 1px solid transparent; border-radius: 10px; color: var(--mute);
  display: inline-flex; align-items: center; gap: 8px;
}
.fb-pill.is-on { background: var(--ink); color: var(--paper); }
.fb-avpill {
  display: inline-flex; align-items: center; gap: 9px;
  font-size: 14px; font-weight: 600; padding: 6px 16px 6px 7px;
  background: var(--surface); border: 2px solid transparent; border-radius: 999px; color: var(--ink);
}
.fb-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }
.fb-ramp { display: flex; gap: 6px; flex-wrap: wrap; }
.fb-shade { width: 40px; height: 28px; border-radius: 7px; display: block; }
.fb-ramp-sm .fb-shade { width: 22px; height: 16px; border-radius: 4px; }
button.fb-shade { border: 2px solid transparent; }
button.fb-shade.is-on { border-color: var(--ink); }

.fb-ghost {
  font-size: 14px; font-weight: 600; padding: 11px 17px;
  background: var(--surface); border-radius: 10px; color: var(--mute);
}
.fb-ghost-sm { font-size: 12px; padding: 8px 12px; }
.fb-check { display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; }
.fb-check-sm { font-size: 13px; color: var(--mute); }
.fb-check input { width: 19px; height: 19px; accent-color: var(--ink); }
.fb-inline { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; }
.fb-inlabel { font-size: 13px; color: var(--mute); }
.fb-inval { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fb-note { margin: 0; font-size: 12px; line-height: 1.6; color: var(--mute); max-width: 68ch; }

.fb-members { display: flex; flex-direction: column; gap: 12px; }
.fb-memberblock {
  display: flex; flex-direction: column; gap: 7px;
  padding-bottom: 11px; border-bottom: 1px solid var(--line);
}
.fb-memberrow { display: flex; align-items: center; gap: 9px; }
.fb-memberfoot { display: flex; align-items: center; gap: 16px; padding-left: 53px; }
.fb-memberfoot .fb-ramp { margin-left: auto; }
.fb-swatch {
  width: 38px; height: 38px; flex: none; padding: 0;
  border: 1px solid var(--line); border-radius: 9px; background: none; cursor: pointer;
}
.fb-hexrow { display: flex; align-items: center; gap: 9px; }

/* Sleep */
.fb-veil {
  position: absolute; inset: 0; z-index: 60;
  background: #000; display: grid; place-items: center; transition: opacity .8s ease;
}
.fb-veilinner {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  color: #fff; transition: opacity .8s ease;
}
.fb-veilclock { font-size: 74px; font-weight: 300; letter-spacing: -.045em; font-variant-numeric: tabular-nums; }
.fb-veildate { font-size: 18px; font-weight: 400; }

/* Screensaver */
.fb-saver { position: absolute; inset: 0; z-index: 50; }
.fb-saverscrim {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,.66), rgba(0,0,0,.1) 55%, transparent);
}
.fb-savertext {
  position: absolute; left: 46px; bottom: 42px;
  display: flex; flex-direction: column; gap: 3px; color: #2A2D33;
}
.fb-saver.has-photo .fb-savertext { color: #fff; }
.fb-saverclock { font-size: 104px; font-weight: 800; line-height: .86; letter-spacing: -.05em; font-variant-numeric: tabular-nums; }
.fb-saverdate { font-size: 23px; font-weight: 500; }
.fb-savernext { font-size: 16px; font-weight: 500; opacity: .72; margin-top: 6px; }

@media (prefers-reduced-motion: reduce) {
  .fb-root *, .fb-root *::before, .fb-root *::after {
    transition-duration: .01ms !important; animation-duration: .01ms !important;
  }
}
`;
