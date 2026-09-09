import { clampHex, variantColor, VARIATION_COUNT } from "../../lib/color.js";
import { uid } from "../../lib/uid.js";
import { THEMES } from "../../lib/theme.js";
import { Avatar } from "../shell/Avatar.jsx";
import { Sheet } from "../shell/Sheet.jsx";
import { Field } from "../shell/Field.jsx";

/*
  Board settings. Moved verbatim from family-board.jsx:1441-1625.

  Everything is configured here — PLAN.md §1 records "not building:
  onboarding" as a locked decision, so this panel is the only configuration
  surface the board will ever have. Three later roles add sections to this
  file: R6 the weather location (landed — the "Weather" Field below), R9 the
  Drive folder id, R10 the mode toggle.

  The four apostrophes in the prose below are written as &apos; rather than as
  literal quotes. That is not a style preference: `react/no-unescaped-entities`
  is on for the whole tree, and R1's relaxation of it applied only to
  family-board.jsx, which no longer exists. The rendered text is
  character-identical to the prototype's — &apos; decodes to U+0027, the same
  ASCII apostrophe the prototype used.

  Two notes for R3, whose backlog item 4 rewrites the settings shape:

    - The Sleep section exposes `sleepDim` as a 0-0.4 range slider. The spec
      asks for a discrete black-or-dim choice, which becomes `sleepStyle`.
    - `wakeTapSeconds` is *displayed* in the Sleep note and nowhere editable.
      It is a hardcoded 90 in DEFAULT_SETTINGS.

  One latent crash R2 found and is not authorized to fix — logged as Deferred
  Defect #12. The Board color section reads
  `THEMES[settings.theme].paper` with no fallback, while every other consumer
  writes `THEMES[settings.theme] || THEMES.paper`. A persisted settings blob
  naming a theme this build does not have — a rename, a downgrade, a partial
  migration — throws on opening Settings, which is the one panel you would
  need to fix it from. R3's migrate() is the natural home for the fix.
*/
export function Settings({ settings, setSettings, members, setMembers, onClose }) {
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setMember = (id, patch) =>
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const setWeather = (k, v) =>
    setSettings((s) => ({ ...s, weather: { ...s.weather, [k]: v } }));

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
                { id: uid(), name: "New person", color: "#A8D8D0", photo: "", onBoard: true },
              ])
            }
          >
            Add person
          </button>
        </div>
        <p className="fb-note">
          The strip beside each name is that person&apos;s eleven shades. Google&apos;s event colors
          1 to 11 land on these, so two of Brian&apos;s events can look different without either of
          them stopping looking like Brian.
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
        <p className="fb-note">
          A tap brings the board back for {settings.wakeTapSeconds} seconds, then it dims again. The
          iPad never locks, so there is no swipe and no passcode.
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
          Weather needs no account &mdash; Open-Meteo is keyless. Coordinates only, no street address;
          find yours from any map by long-pressing a point. Empty latitude or longitude hides the
          weather chip.
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
