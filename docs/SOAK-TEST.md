# Multi-day soak test

R12's own handoff note (`PLAN.md` §7) flags this explicitly: its acceptance
bar was code — an audit of every timer and listener in `src/` — not a live
multi-day run, and names this runbook as the right home for the actual
procedure. This is that procedure. Run it once after
[DEVICE-SETUP.md](./DEVICE-SETUP.md) and before trusting the board to run
unattended for real, and again after any change that touches a timer, a
poll loop, or the idle/sleep paths.

## What's actually running, continuously, on this board

Worth knowing before watching for anomalies — these are all expected to fire
forever, not leaks:

| Interval                        | What                                          | Where                                           |
| ------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| 1s (typically)                  | Clock tick driving the now-line and countdown | `src/hooks/useNow.js`                           |
| 30s                             | Screensaver photo rotation, while idle        | `src/components/idle/Screensaver.jsx`           |
| 5 min                           | Calendar poll (sync-token delta)              | `src/data/google.js` (`POLL_MS`)                |
| 30 min                          | Drive photo list re-fetch                     | `src/data/drive.js` (`POLL_MS`)                 |
| per `useSleep`/`useIdle` config | Bedtime/wake and idle-timeout checks          | `src/hooks/useSleep.js`, `src/hooks/useIdle.js` |

The 5-minute calendar poll is the one to pay closest attention to: R12's own
note in `PLAN.md` records a real bug here (a wholesale cache replace on every
sync-token delta was silently erasing unrelated events every 5 minutes) that
only a running board — not a unit test — actually surfaced. Trust actual
multi-day behavior over "the tests pass" for anything touching this path.

The 30-minute Drive poll is the second one to watch, for a different reason.
Photos are painted from Drive's `thumbnailLink`, which is a signed URL with a
validity window Google does not document. The poll is what keeps a fresh one
in hand, and `src/data/drive.js` gives its offline cache a 45-minute TTL so a
stale signature can never outlive it — past that the screensaver falls back to
month art. A multi-day soak is the only thing that surfaces the failure mode
worth knowing about: photos that render on day one and turn into blank or
broken frames later would mean the real expiry is shorter than the poll, and
`POLL_MS` here needs to come down.

## Setup

1. Deploy and install the board normally (`DEPLOY.md`, `DEVICE-SETUP.md`).
   Use a real calendar with real events spanning the test window, not an
   empty one — a bug in the poll path (like the one above) only shows up
   when there's something in view to silently lose.
2. Connect Web Inspector once (`RECOVERY.md`'s "Inspecting the board's own
   storage") so you have a way to check in without disturbing Guided Access.
3. Note the exact start time and take a baseline reading (below) before
   walking away.

## What to check, and how often

**Daily, for at least 3–4 days minimum (a week is better):**

1. **Look at the board.** Does it still show today's real events? A
   regression in the poll path shows up as events quietly vanishing over
   days, not as a crash — glance for anything that should be there and isn't.
2. **Memory.** Web Inspector → the board's page → **Timelines** tab →
   record a short **Memory** sample. JS heap should hover in a stable range
   across days, not climb monotonically. Some sawtooth (grow, GC, drop) is
   normal; a staircase that never comes back down across multiple days is
   the leak signature.
3. **The clock.** Compare the board's displayed time against an actual
   clock. `useNow`'s `setInterval` should never drift visibly — if it does,
   suspect the tab being backgrounded/throttled rather than the interval
   itself (shouldn't happen in a Guided-Access-pinned standalone app, which
   is one more reason to actually run Guided Access rather than a bare
   Safari tab for this test).
4. **Sleep/wake.** Confirm the board actually went to sleep at `bedtime` and
   woke at `wakeTime` (Settings → Sleep) each night of the run — a tap during
   the day, per `wakeTapSeconds`, should return it to sleep on schedule
   rather than staying awake.
5. **Console.** Skim for anything logged with a `[board]` prefix — errors
   the app itself is aware of and reporting (see `RECOVERY.md`).

**At the end of the run:**

1. Final memory sample — compare against day 1's baseline. Flat or sawtooth
   = pass. A sustained upward trend across the whole run = fail, and worth
   filing as a defect with the Timelines recording attached.
2. Confirm calendar events created or changed on Google partway through the
   test window actually appeared on the board without a manual reload —
   this is the direct regression test for the poll-cache bug R12's note
   describes.
3. Confirm notes, chores, and settings edited partway through the run are
   still present and correct — this is `store.js`'s persistence path, not
   the poll path, and is a different failure mode if it breaks.

## Pass bar

Flat (not monotonically growing) memory across the full run, a clock that
never drifted, sleep/wake firing on schedule every night, and events staying
correct and current throughout — matching PLAN.md §R12's own acceptance
line: _"a multi-day soak run shows flat memory."_
