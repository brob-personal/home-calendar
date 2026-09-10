import { useState } from "react";

import { clampHex, variantColor, VARIATION_COUNT } from "../../lib/color.js";
import { uid } from "../../lib/uid.js";
import { THEMES } from "../../lib/theme.js";
import { MODES } from "../../contracts/schema.js";
import { useMode } from "../../state/ModeContext.js";
import { fetchAccessRole } from "../../data/google.js";
import { Avatar } from "../shell/Avatar.jsx";
import { Sheet } from "../shell/Sheet.jsx";
import { Field } from "../shell/Field.jsx";

/* "Roommate" reads better than the raw mode id in a UI label; every other
   mode id is already its own label. */
const MODE_LABELS = { personal: "Personal", roommate: "Roommate" };

/*
  Board settings. Moved verbatim from family-board.jsx:1441-1625.

  Everything is configured here — PLAN.md §1 records "not building:
  onboarding" as a locked decision, so this panel is the only configuration
  surface the board will ever have. Three later roles add sections to this
  file: R6 the weather location (landed — the "Weather" Field below), R9 the
  Drive folder id (landed — the "Photos" Field below), and R10 the mode
  toggle (landed — the "Mode" Field below) plus the per-member "Personal" /
  "Roommate" checkboxes in the Family section, which are the roster editor
  R3's DEFAULT_MEMBERS comment was written expecting: the roommates are not
  the family (SCOPING.txt), so which mode a person belongs to is data on the
  Member, set here.

  The four apostrophes in the prose below are written as &apos; rather than as
  literal quotes. That is not a style preference: `react/no-unescaped-entities`
  is on for the whole tree, and R1's relaxation of it applied only to
  family-board.jsx, which no longer exists. The rendered text is
  character-identical to the prototype's — &apos; decodes to U+0027, the same
  ASCII apostrophe the prototype used.

  Deferred Defect #16, fixed. The Sleep section now has a Black/Dim pill pair
  bound to `settings.sleepStyle` (R3's discrete choice) instead of only the
  0-0.4 `sleepDim` slider, which the pills now gate — it only means anything
  when the style is "dim". App.jsx passes `0` for `<SleepVeil>`'s opacity
  when the style is "black"; `SleepVeil` still floors that at 0.02 so a
  sleeping board never reads as a dead one, by the same reasoning as its own
  header comment. `wakeTapSeconds`, previously only *displayed* in the Sleep
  note, is now an editable number field next to it, clamped the same 5-3600
  range `migrate()` already enforces on load (../contracts/migrate.js).

  Deferred Defect #12: R3's migrate() already validates `theme` against
  THEMES on every load (PLAN.md §7's note from R3), so the crash this defect
  named is unreachable in practice. The Board color section's read is
  tidied anyway, to `THEMES[settings.theme] || THEMES.paper`, matching every
  other consumer — defense in depth against whatever reaches this panel next.
*/
export function Settings({ settings, setSettings, members, setMembers, onClose }) {
  const { mode, setMode } = useMode();

  /* A calendar with exactly one member below is reclassified out of "Joint
     calendars" and into that person's own row (see the comment above
     jointCalendars). Every calendar starts life at 0 members, so the very
     first checkbox click on a brand-new row would otherwise immediately drop
     its count to 1 and yank the row out from under the user before they can
     check a second name — making an actual 2+-person joint calendar
     impossible to build by clicking checkboxes one at a time. Rows the user
     has touched this session stay put in Joint calendars regardless of
     member count until Settings is closed and reopened, at which point a
     row that settled on exactly one member correctly reappears only on that
     person's own row. Keyed by `${mode}-${i}` so a mode switch can't make a
     stale index from one mode's list pin the wrong row in the other's. */
  const [pinnedJointRows, setPinnedJointRows] = useState(() => new Set());

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setMember = (id, patch) =>
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const setWeather = (k, v) => setSettings((s) => ({ ...s, weather: { ...s.weather, [k]: v } }));
  const setDrive = (k, v) => setSettings((s) => ({ ...s, drive: { ...s.drive, [k]: v } }));
  const calendarList = settings.calendars[mode] || [];
  const setCalendars = (list) =>
    setSettings((s) => ({ ...s, calendars: { ...s.calendars, [mode]: list } }));
  const updateCalendarAt = (i, patch) =>
    setCalendars(calendarList.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCalendarAt = (i) => {
    setCalendars(calendarList.filter((_, idx) => idx !== i));
    setPinnedJointRows((prev) => {
      const next = new Set();
      for (const key of prev) {
        const [m, idxStr] = key.split("-");
        const idx = Number(idxStr);
        if (m !== mode) next.add(key);
        else if (idx < i) next.add(key);
        else if (idx > i) next.add(`${m}-${idx - 1}`);
      }
      return next;
    });
  };
  const toggleCalendarMember = (i, memberId) => {
    const cal = calendarList[i];
    const has = cal.memberIds.includes(memberId);
    setPinnedJointRows((prev) => {
      const rowKey = `${mode}-${i}`;
      return prev.has(rowKey) ? prev : new Set(prev).add(rowKey);
    });
    updateCalendarAt(i, {
      memberIds: has ? cal.memberIds.filter((x) => x !== memberId) : [...cal.memberIds, memberId],
    });
  };

  /* A person's own calendar is just a CalendarLink whose only owner is them —
     no new shape, so google.js's readActiveCalendars() picks it up the same
     way it already picks up every other entry in settings.calendars[mode].
     "Joint calendars" below is everything else: 0 owners (not yet assigned a
     colour) or 2+ (a shared calendar two or more people split colour on). */
  const memberCalendarIndex = (memberId) =>
    calendarList.findIndex((c) => c.memberIds.length === 1 && c.memberIds[0] === memberId);
  const memberCalendarId = (memberId) => {
    const i = memberCalendarIndex(memberId);
    return i === -1 ? "" : calendarList[i].id;
  };
  const setMemberCalendarId = (memberId, value) => {
    const trimmed = value.trim();
    const i = memberCalendarIndex(memberId);
    if (i === -1) {
      if (trimmed) setCalendars([...calendarList, { id: trimmed, memberIds: [memberId], enabled: true }]);
      return;
    }
    if (!trimmed) {
      removeCalendarAt(i);
      return;
    }
    updateCalendarAt(i, { id: trimmed });
  };
  const jointCalendars = calendarList
    .map((cal, i) => ({ cal, i }))
    .filter(({ cal, i }) => cal.memberIds.length !== 1 || pinnedJointRows.has(`${mode}-${i}`));

  /*
    The other half of the two check points src/contracts/schema.js's
    CalendarLink.accessRole comment names: this one, on entry/save, so a
    newly-linked calendar has a role before the first 5-minute poll ever
    runs; useCalendarAccessSync (src/data/google.js, mounted from App.jsx)
    is the periodic re-check for one already linked. A blank/mistyped id, or
    running in mock/dev mode with no VITE_BOARD_DEVICE_SECRET, both resolve
    to no-op via fetchAccessRole's own null-on-failure contract.
  */
  const checkCalendarAccess = (calendarId, apply) => {
    const deviceSecret = import.meta.env.VITE_BOARD_DEVICE_SECRET || "";
    if (!deviceSecret || !calendarId) return;
    const apiBase = import.meta.env.VITE_API_BASE_URL || "";
    fetchAccessRole({ apiBase, deviceSecret, calendarId }).then((accessRole) => {
      if (accessRole) apply(accessRole);
    });
  };

  /* A member with no mode at all is invisible everywhere — the same
     invariant normalizeModes() enforces on load. Unchecking a person's only
     remaining mode here is refused rather than silently producing that
     state, so the checkbox itself cannot create a member Settings has no way
     to find again. */
  const toggleMemberMode = (m, targetMode) => {
    const has = m.modes.includes(targetMode);
    if (has && m.modes.length === 1) return;
    const modes = has ? m.modes.filter((x) => x !== targetMode) : [...m.modes, targetMode];
    setMember(m.id, { modes });
  };

  return (
    <Sheet title="Board settings" onClose={onClose} wide>
      <Field label="Mode">
        <div className="fb-pills">
          {MODES.map((m) => (
            <button
              key={m}
              className={`fb-pill${mode === m ? " is-on" : ""}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m] || m}
            </button>
          ))}
        </div>
        <p className="fb-note">
          Personal mode shows the family calendar. Roommate mode shows a separate calendar and
          roster for when the board is on public display, and adds a To-do tab. Switch who is on
          each below.
        </p>
      </Field>

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
                  value={memberCalendarId(m.id)}
                  onChange={(e) => setMemberCalendarId(m.id, e.target.value)}
                  onBlur={(e) =>
                    checkCalendarAccess(e.target.value.trim(), (accessRole) => {
                      const i = memberCalendarIndex(m.id);
                      if (i !== -1) updateCalendarAt(i, { accessRole });
                    })
                  }
                  placeholder="Calendar ID"
                  spellCheck="false"
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
                {MODES.map((targetMode) => (
                  <label className="fb-check fb-check-sm" key={targetMode}>
                    <input
                      type="checkbox"
                      checked={m.modes.includes(targetMode)}
                      onChange={() => toggleMemberMode(m, targetMode)}
                    />
                    <span>{MODE_LABELS[targetMode] || targetMode}</span>
                  </label>
                ))}
                <div className="fb-ramp fb-ramp-sm">
                  {Array.from({ length: VARIATION_COUNT }, (_, i) => (
                    <span
                      key={i}
                      className="fb-shade"
                      style={{ background: variantColor(m.color, i) }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
          <button
            className="fb-ghost"
            onClick={() =>
              setMembers((ms) => [
                ...ms,
                {
                  id: uid(),
                  name: "New person",
                  color: "#A8D8D0",
                  photo: "",
                  onBoard: true,
                  modes: [...MODES],
                },
              ])
            }
          >
            Add person
          </button>
        </div>
        <p className="fb-note">
          To add someone else&apos;s calendar: have them open Google Calendar, go to that
          calendar&apos;s Settings and sharing, and share it with brianjrobinson03@gmail.com
          (at least &ldquo;See all event details&rdquo;). Once shared, find the Calendar ID under
          &ldquo;Integrate calendar&rdquo; in that same settings page &mdash; it&apos;s their email for a
          primary calendar, or a long id ending in @group.calendar.google.com for a
          secondary one &mdash; and paste it here next to their name.
        </p>
        <p className="fb-note">
          The strip beside each name is that person&apos;s eleven shades. Google&apos;s event colors
          1 to 11 land on these, so two of Brian&apos;s events can look different without either of
          them stopping looking like Brian.
        </p>
      </Field>

      <Field label="Joint calendars">
        <div className="fb-members">
          {jointCalendars.map(({ cal, i }) => (
            <div className="fb-memberblock" key={`${mode}-${i}`}>
              <div className="fb-inline">
                <input
                  className="fb-input fb-input-sm"
                  value={cal.id}
                  onChange={(e) => updateCalendarAt(i, { id: e.target.value.trim() })}
                  onBlur={(e) =>
                    checkCalendarAccess(e.target.value.trim(), (accessRole) =>
                      updateCalendarAt(i, { accessRole }),
                    )
                  }
                  placeholder="you@gmail.com or calendar id"
                  spellCheck="false"
                />
                <label className="fb-check fb-check-sm">
                  <input
                    type="checkbox"
                    checked={cal.enabled !== false}
                    onChange={(e) => updateCalendarAt(i, { enabled: e.target.checked })}
                  />
                  <span>Enabled</span>
                </label>
                <button className="fb-ghost fb-ghost-sm" onClick={() => removeCalendarAt(i)}>
                  Remove
                </button>
              </div>
              <div className="fb-inline">
                {members.map((m) => (
                  <label className="fb-check fb-check-sm" key={m.id}>
                    <input
                      type="checkbox"
                      checked={cal.memberIds.includes(m.id)}
                      onChange={() => toggleCalendarMember(i, m.id)}
                    />
                    <span>{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            className="fb-ghost"
            onClick={() => setCalendars([...calendarList, { id: "", memberIds: [], enabled: true }])}
          >
            Add calendar
          </button>
        </div>
        <p className="fb-note">
          Calendars that aren&apos;t any one person&apos;s &mdash; a shared family calendar, for
          example &mdash; go here instead of on a person&apos;s row above. Check every person whose
          color its events should wear; checking two or more is what makes a shared event show as a
          diagonal split. Only enabled calendars sync.
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
              <span
                className="fb-dot"
                style={{ background: t.paper, border: `1px solid ${t.line}` }}
              />
              {t.label}
            </button>
          ))}
        </div>
        <div className="fb-hexrow">
          <input
            type="color"
            className="fb-swatch"
            value={clampHex(settings.customPaper || (THEMES[settings.theme] || THEMES.paper).paper)}
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
          <input
            className="fb-input fb-input-sm"
            type="time"
            value={settings.bedtime}
            onChange={(e) => set("bedtime", e.target.value)}
          />
          <span className="fb-inlabel">Wake at</span>
          <input
            className="fb-input fb-input-sm"
            type="time"
            value={settings.wakeTime}
            onChange={(e) => set("wakeTime", e.target.value)}
          />
        </div>
        <div className="fb-pills">
          {[
            { id: "black", label: "Black" },
            { id: "dim", label: "Dim" },
          ].map((s) => (
            <button
              key={s.id}
              className={`fb-pill${settings.sleepStyle === s.id ? " is-on" : ""}`}
              onClick={() => set("sleepStyle", s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {settings.sleepStyle === "dim" && (
          <div className="fb-inline">
            <span className="fb-inlabel">Brightness while asleep</span>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.02"
              value={settings.sleepDim}
              onChange={(e) => set("sleepDim", Number(e.target.value))}
            />
            <span className="fb-inval">{Math.round(settings.sleepDim * 100)}%</span>
          </div>
        )}
        <div className="fb-inline">
          <span className="fb-inlabel">A tap wakes the board for</span>
          <input
            className="fb-input fb-input-sm"
            type="number"
            min="5"
            max="3600"
            value={settings.wakeTapSeconds}
            onChange={(e) => set("wakeTapSeconds", Number(e.target.value))}
          />
          <span className="fb-inlabel">seconds</span>
        </div>
        <p className="fb-note">
          Then it {settings.sleepStyle === "black" ? "goes black" : "dims"} again. The iPad never
          locks, so there is no swipe and no passcode.
        </p>
      </Field>

      <Field label="Idle">
        <label className="fb-check">
          <input
            type="checkbox"
            checked={settings.screensaver}
            onChange={(e) => set("screensaver", e.target.checked)}
          />
          <span>Show the photo screen when nobody has touched the board</span>
        </label>
        <div className="fb-inline">
          <span className="fb-inlabel">After</span>
          <input
            className="fb-input fb-input-sm"
            type="number"
            min="1"
            max="60"
            value={settings.idleMinutes}
            onChange={(e) => set("idleMinutes", Number(e.target.value))}
          />
          <span className="fb-inlabel">minutes</span>
        </div>
        <label className="fb-check">
          <input
            type="checkbox"
            checked={settings.monthArt}
            onChange={(e) => set("monthArt", e.target.checked)}
          />
          <span>Tint the board with this month&apos;s artwork</span>
        </label>
      </Field>

      <Field label="Hours shown on the day and week views">
        <div className="fb-inline">
          <input
            className="fb-input fb-input-sm"
            type="number"
            min="0"
            max="12"
            value={settings.dayStart}
            onChange={(e) => set("dayStart", Number(e.target.value))}
          />
          <span className="fb-inlabel">to</span>
          <input
            className="fb-input fb-input-sm"
            type="number"
            min="13"
            max="24"
            value={settings.dayEnd}
            onChange={(e) => set("dayEnd", Number(e.target.value))}
          />
        </div>
      </Field>

      <Field label="Time format">
        <div className="fb-pills">
          {[
            { key: "12", label: "12-hour" },
            { key: "24", label: "24-hour" },
          ].map((opt) => (
            <button
              key={opt.key}
              className={`fb-pill${settings.timeFormat === opt.key ? " is-on" : ""}`}
              onClick={() => set("timeFormat", opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Weather">
        <div className="fb-inline">
          <span className="fb-inlabel">Location name</span>
          <input
            className="fb-input fb-input-sm"
            value={settings.weather.label}
            onChange={(e) => setWeather("label", e.target.value)}
            placeholder="Home"
          />
        </div>
        <div className="fb-inline">
          <span className="fb-inlabel">Latitude</span>
          <input
            className="fb-input fb-input-sm"
            type="number"
            step="0.0001"
            min="-90"
            max="90"
            value={settings.weather.lat ?? ""}
            onChange={(e) =>
              setWeather("lat", e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder="33.7490"
          />
          <span className="fb-inlabel">Longitude</span>
          <input
            className="fb-input fb-input-sm"
            type="number"
            step="0.0001"
            min="-180"
            max="180"
            value={settings.weather.lon ?? ""}
            onChange={(e) =>
              setWeather("lon", e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder="-84.3880"
          />
        </div>
        <div className="fb-pills">
          {["F", "C"].map((u) => (
            <button
              key={u}
              className={`fb-pill${settings.weather.units === u ? " is-on" : ""}`}
              onClick={() => setWeather("units", u)}
            >
              °{u}
            </button>
          ))}
        </div>
        <p className="fb-note">
          Weather needs no account &mdash; Open-Meteo is keyless. Coordinates only, no street
          address; find yours from any map by long-pressing a point. Empty latitude or longitude
          hides the weather chip.
        </p>
      </Field>

      <Field label="Photos">
        <div className="fb-inline">
          <span className="fb-inlabel">Drive folder id</span>
          <input
            className="fb-input fb-input-sm"
            value={settings.drive.folderId}
            onChange={(e) => setDrive("folderId", e.target.value.trim())}
            placeholder="1a2B3cD4EfGhIjKlmNoPqRsTuVwXyZ"
            spellCheck="false"
          />
        </div>
        <p className="fb-note">
          First, share the Drive folder you want to use with brianjrobinson03@gmail.com &mdash; it
          does not need edit access, viewing access is enough, but it does need to be shared. The
          idle screensaver rotates through images in this Drive folder in place of the
          month&apos;s artwork. Find the id in the folder&apos;s share link &mdash;
          drive.google.com/drive/folders/<b>this part</b>. Leave it empty to keep the month art.
          Only image files are shown; the board can read the folder but never edits it.
        </p>
      </Field>

      <div className="fb-sheetfoot">
        <button className="fb-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
