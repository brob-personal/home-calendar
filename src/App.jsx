import { useState, useMemo, useEffect } from "react";

import { startOfDay, daysUntil } from "./lib/date.js";
import { ACCENT_NOW, MONTH_ART } from "./lib/theme.js";

import { useNow } from "./hooks/useNow.js";
import { useBoardData } from "./hooks/useBoardData.js";
import { useMemberFilter } from "./hooks/useMemberFilter.js";
import { useSleep } from "./hooks/useSleep.js";
import { useDrivePhotos } from "./data/drive.js";
import { PaletteContext, useBoardPalette } from "./state/PaletteContext.js";
import { BoardContext } from "./state/BoardContext.js";
import { ModeContext, useModeState } from "./state/ModeContext.js";

import { Fit } from "./components/shell/Fit.jsx";
import { BoardStyles } from "./components/shell/BoardStyles.jsx";
import { Header } from "./components/shell/Header.jsx";
import { Countdowns } from "./components/shell/Countdowns.jsx";
import { Footer } from "./components/shell/Footer.jsx";
import { DayView } from "./components/views/DayView.jsx";
import { WeekView } from "./components/views/WeekView.jsx";
import { MonthView } from "./components/views/MonthView.jsx";
import { AgendaView } from "./components/views/AgendaView.jsx";
import { EventDetailSheet } from "./components/views/EventDetailSheet.jsx";
import { NoteDock } from "./components/notes/NoteDock.jsx";
import { NoteWindow } from "./components/notes/NoteWindow.jsx";
import { Composer } from "./components/settings/Composer.jsx";
import { Settings } from "./components/settings/Settings.jsx";
import { SleepVeil } from "./components/idle/SleepVeil.jsx";
import { Screensaver } from "./components/idle/Screensaver.jsx";

/* ============================================================================
   FAMILY BOARD — wall-mounted calendar for iPad 7th gen (A2197)
   ----------------------------------------------------------------------------
   Canvas is locked to 1080 x 810 CSS px (2160 x 1620 @2x), landscape. The
   <Fit> wrapper scales that canvas to whatever viewport it lands in, so what
   you see here is what the iPad shows. On device the scale resolves to 1.

   Runs with Auto-Lock set to Never. The screen never sleeps at the OS level;
   all dimming, sleeping and screensaver behavior happens in here so the device
   never shows a lock screen and never needs a swipe to reopen.
   ----------------------------------------------------------------------------
   This was family-board.jsx:423-680 — a 255-line component owning 11 state
   slices, persistence, filtering, colour derivation, sleep, notes and event
   CRUD at once. What is left is composition plus the four pieces of state
   that are genuinely about *this* component: which view is showing, which day
   is anchored, which panel is open, and whether the note window is up.

   Hook order below is load-bearing and matches the prototype's effect order
   exactly: useNow's interval registers first, then useBoardData's load
   effect and its three write-through effects, then useSleep's idle listeners
   and wake timer. useMemberFilter and useBoardPalette contribute only memos.
   ========================================================================== */
export default function App() {
  const now = useNow();
  const data = useBoardData(now);
  const { members, settings } = data;

  const [view, setView] = useState("day");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [panel, setPanel] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  /*
    R7: which event the detail sheet has open, if any. Lives at App's level
    rather than inside any one view because PLAN.md §R7 item 5 requires the
    sheet reachable from all four views — Day, Week, Month and Agenda each
    call onSelect(event) on a tap, and the sheet itself doesn't care which view
    opened it.
  */
  const [selectedEvent, setSelectedEvent] = useState(null);

  /*
    R10: which mode is active, and everything that follows from it — the
    roster narrowed to this mode's members, this mode's calendar set, and the
    view list Footer switches between. Computed the same way useBoardPalette
    is — a plain hook called directly, because App cannot consume the context
    it is about to provide below. Everything past this point that used to
    read `members` reads `roster` instead, so toggling the mode swaps the
    footer's legend, every view's events, and the composer's "Who" picker
    wholesale. Settings keeps the full, unnarrowed `members` list — it is
    where a person's mode membership gets assigned in the first place.
  */
  const modeState = useModeState(members, settings, data.setSettings);
  const { roster, views, isRoommate } = modeState;

  /* The To-do tab only exists in Roommate mode (PLAN.md §R10 item 5). Without
     this, switching out of Roommate mode while it is open would leave `view`
     pointing at a tab Footer no longer renders — no button lit, an empty
     stage. */
  useEffect(() => {
    if (!views.includes(view)) setView("day");
  }, [views, view]);

  /*
    useMemberFilter's "hidden" list is an exclusion list, not an allowlist —
    it was built to answer "which of these members did you tap off", never
    "does this event belong to someone in scope at all". Handing it `roster`
    alone would still let a family event through while looking at the
    Roommate board, because nobody on that event was ever added to a hidden
    list scoped to a roster that no longer contains them. Mode narrows the
    universe of events before the avatar-tap filter narrows it further.
  */
  const rosterIds = useMemo(() => new Set(roster.map((m) => m.id)), [roster]);
  const modeEvents = useMemo(
    () => data.events.filter((e) => (e.memberIds || []).some((id) => rosterIds.has(id))),
    [data.events, rosterIds],
  );

  const { isShown, shownMembers, filtered, filterTouched, toggleMember, resetFilter } =
    useMemberFilter(roster, modeEvents);

  /*
    `palette` is all App still needs from the bundle — for the CSS custom
    properties below. `fillFor` and `firstColor` used to be destructured here
    and threaded down as props to three views and the countdown ticker; they
    now travel by context, which is PLAN.md §R2 item 5 in one line of diff.
  */
  const paletteBundle = useBoardPalette(roster, settings, isShown);
  const { palette } = paletteBundle;

  const { dimmed, showSaver, wake } = useSleep(now, settings, Boolean(panel) || noteOpen);

  /*
    R9, disclosed per PLAN.md §5 rule 3: one line reaching outside its own
    owned paths (src/data/drive.js, api/drive/**, Settings.jsx), the same
    exception R6 recorded for wiring WeatherWidget into Header.jsx. App.jsx
    is the only place that already holds both `settings` and `setSettings`
    outside of BoardContext, and this hook can't read that context itself —
    App is the component that renders the Provider, not one of its
    descendants. The hook is side-effect only: it feeds settings.photos, and
    Screensaver's own prop below is unchanged.
  */
  useDrivePhotos(settings, data.setSettings);

  const monthArt = MONTH_ART[now.getMonth()];

  const milestones = useMemo(
    () =>
      filtered
        .filter((e) => e.milestone && daysUntil(e.start, now) >= 0)
        .sort((a, b) => a.start - b.start)
        .slice(0, 4),
    [filtered, now],
  );

  const addEvent = async (draft) => {
    await data.createEvent(draft);
    setPanel(null);
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
      <BoardStyles />
      {/*
        R3: the board-data bundle is published on a context as well as passed
        down as props. R6's weather settings and R11's future chores tab read
        it from here; App itself keeps using the props it already has.
      */}
      <BoardContext.Provider value={data}>
        {/*
          R10: the mode bundle App already computed above, published for
          Settings' mode toggle and R11's chores tab — neither reachable by
          prop from here. App does not consume this itself; see
          src/state/ModeContext.js for why.
        */}
        <ModeContext.Provider value={modeState}>
        <PaletteContext.Provider value={paletteBundle}>
          <div className="fb-root" style={cssVars}>
            {settings.monthArt && (
              <div
                className="fb-art"
                style={{ backgroundImage: monthArt.art }}
                aria-hidden="true"
              />
            )}

            <div className="fb-board">
              <Header
                now={now}
                anchor={anchor}
                events={filtered}
                onToday={() => setAnchor(startOfDay(new Date()))}
                onSettings={() => setPanel("settings")}
              />

              {milestones.length > 0 && <Countdowns items={milestones} now={now} />}

              <main className="fb-stage">
                {view === "day" && (
                  <DayView
                    date={anchor}
                    now={now}
                    events={filtered}
                    members={shownMembers}
                    settings={settings}
                    onSelect={setSelectedEvent}
                  />
                )}
                {view === "week" && (
                  <WeekView
                    date={anchor}
                    now={now}
                    events={filtered}
                    settings={settings}
                    onSelect={setSelectedEvent}
                  />
                )}
                {view === "month" && (
                  <MonthView
                    date={anchor}
                    now={now}
                    events={filtered}
                    onPick={(d) => {
                      setAnchor(d);
                      setView("day");
                    }}
                    onSelect={setSelectedEvent}
                  />
                )}
                {/* `roster`, not `shownMembers` — Deferred Defect #2, R12's to fix. */}
                {view === "agenda" && (
                  <AgendaView
                    date={anchor}
                    now={now}
                    events={filtered}
                    members={roster}
                    onSelect={setSelectedEvent}
                  />
                )}
                {/* R11 owns the real chores tab (src/components/chores/**); this
                    placeholder only keeps the tab from opening onto a blank
                    stage between R10 landing the switcher and R11 landing the
                    content it switches to. */}
                {view === "todo" && isRoommate && (
                  <div className="fb-todoplaceholder">Chores are coming soon.</div>
                )}
              </main>

              <Footer
                view={view}
                setView={setView}
                views={views}
                anchor={anchor}
                setAnchor={setAnchor}
                members={roster}
                isShown={isShown}
                onToggleMember={toggleMember}
                showReset={filterTouched}
                onReset={resetFilter}
                onCompose={() => setPanel("compose")}
              />
            </div>

            <NoteDock
              note={data.todayNote}
              onOpen={() => setNoteOpen(true)}
              hidden={noteOpen || Boolean(panel)}
            />

            {/* `members` is dead on arrival here — Deferred Defect #5, R12's. */}
            {noteOpen && (
              <NoteWindow
                notes={data.notes}
                todayKey={data.todayKey}
                now={now}
                members={members}
                onSave={data.saveStrokes}
                onClose={() => setNoteOpen(false)}
              />
            )}

            {panel === "compose" && (
              <Composer
                members={roster}
                date={anchor}
                onSave={addEvent}
                onClose={() => setPanel(null)}
              />
            )}
            {selectedEvent && (
              <EventDetailSheet
                event={selectedEvent}
                members={roster}
                settings={settings}
                onSave={(patch) =>
                  data.updateEvent(selectedEvent.id, patch).then(() => setSelectedEvent(null))
                }
                onDelete={() =>
                  data.deleteEvent(selectedEvent.id).then(() => setSelectedEvent(null))
                }
                onClose={() => setSelectedEvent(null)}
              />
            )}
            {panel === "settings" && (
              <Settings
                settings={settings}
                setSettings={data.setSettings}
                members={members}
                setMembers={data.setMembers}
                onClose={() => setPanel(null)}
              />
            )}

            {showSaver && (
              <Screensaver now={now} art={monthArt} photos={settings.photos} events={filtered} />
            )}
            {dimmed && <SleepVeil now={now} opacity={settings.sleepDim} onWake={wake} />}
          </div>
        </PaletteContext.Provider>
        </ModeContext.Provider>
      </BoardContext.Provider>
    </Fit>
  );
}
