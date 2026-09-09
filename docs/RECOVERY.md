# Recovery — blank, stale, or logged-out board

Bookmark this. Work top to bottom; each section assumes the previous one
didn't apply.

## The board is blank / white screen

**First: wait 30 seconds without touching anything.** A render crash anywhere
in the app is caught by `<ErrorBoundary>` (`src/components/shell/
ErrorBoundary.jsx`), which shows *"The board hit a problem and needs to
restart"* and reloads itself automatically after 30s — most transient
failures (a bad sync response, a race on wake) resolve themselves this way
with zero action needed. If you see that message, either wait or tap
**Reload now** — the button works even inside Guided Access, since it's a
tap inside the one pinned app, not a system gesture.

**Still blank after a reload, or genuinely nothing on screen (not even the
error message)?** That means the page itself never mounted:

1. Check Wi-Fi: **Settings → Wi-Fi**, confirm connected. The board has no
   offline install — the very first load of a session needs the network to
   fetch the app shell; only *after* that does cached data carry it through a
   later outage (see "stale" section below).
2. Check the server side is up: from any other device, visit
   `https://<your-domain>/api/health`. If this itself fails to load, the
   Vercel deployment is down — check the Vercel dashboard for a failed build
   or an outage.
3. Force-reload the board itself: exit Guided Access, close the app fully
   (see [DEVICE-SETUP.md](./DEVICE-SETUP.md) §4), reopen from the home-screen
   icon.
4. If that still shows nothing, a bad deploy is the likely cause. From the
   Vercel dashboard, **Deployments**, find the last deployment that worked,
   **⋯ → Promote to Production** as an immediate rollback, then diagnose the
   bad one separately.

## The board is showing an "Offline" chip, or looks stale

This is the board working as designed, not broken. `Header.jsx` shows an
**Offline** pill (top right, next to the clock) whenever `useBoardData`
reports `degraded` — either the calendar source fell back to its last good
cached copy, or a write to storage failed. The board deliberately keeps
showing the last known-good events rather than going blank (Deferred Defect
#7's resolution, `PLAN.md` §7 items 12–13) — that's the whole point of the
offline cache.

1. Check the iPad's Wi-Fi (as above). This is by far the most common cause.
2. Check `https://<your-domain>/api/health` from another device. If
   `refreshTokenConfigured` is `false` or any other config flag is `false`,
   see "Logged out" below.
3. If Wi-Fi and health both look fine but the chip persists, the Google side
   may be rate-limiting or erroring — check
   `curl -H "X-Board-Secret: <secret>" https://<your-domain>/api/auth/refresh`
   per DEPLOY.md step 6.6. A `502` here with a Google error message is your
   answer; see "Logged out" below if the message mentions the grant/token.
4. The chip clears itself on the next successful sync once the underlying
   cause is fixed — no reload needed.

**How stale, exactly?** Every write to storage is stamped with a real
timestamp (`src/lib/store.js`'s envelope, `{ v, at, data }`) specifically so
this question has an answer that doesn't depend on the app still working.
With the iPad connected to a Mac (see "Inspecting the board's own storage"
below), run in the console:

```js
JSON.parse(localStorage.getItem("board:events")).at
```

That's the timestamp of the last successful write to the events cache.

## The board is "logged out" (calendar never updates, Offline chip won't clear)

The board never holds a Google credential to begin with (`.env.example`'s own
header), so there's no session to log back into on the iPad itself — "logged
out" here means the **server-side refresh token** is invalid or revoked. This
happens if: the Google account owner revoked the app's access, the OAuth
consent screen's test-user grant lapsed, or the client secret was rotated
without repeating the consent flow.

1. Confirm the diagnosis:
   ```
   curl -H "X-Board-Secret: <BOARD_DEVICE_SECRET>" https://<your-domain>/api/auth/refresh
   ```
   A `502` with a message like `invalid_grant` confirms the refresh token
   itself is dead, not a transient network issue.
2. Fix: repeat [DEPLOY.md](./DEPLOY.md) step 6 (the OAuth consent flow) to
   mint a fresh `GOOGLE_REFRESH_TOKEN`, set it, redeploy.
3. Re-run the `curl` from step 1 — expect `{"ok":true,...}`.
4. The iPad needs no action at all once the token is fixed server-side; its
   next poll cycle (R8's 5-minute cadence) picks it up on its own.

## Storage is corrupt, or reports "full"

`store.js` deliberately does **not** self-heal a corrupt value (its own
comment: *"Deleting the key here would turn a diagnosable corruption into an
amnesiac board... a human clears it"*). If the board's console (see below)
shows a `StorageError` with `code: "corrupt"` or `code: "quota"`:

1. **Back up first** — see [BACKUP-RESTORE.md](./BACKUP-RESTORE.md). Clearing
   storage loses notes, settings, and chore state if you skip this.
2. Inspecting/clearing one slice only (preferred — keeps everything else):
   with the iPad connected to a Mac and Web Inspector open (below), run
   ```js
   localStorage.removeItem("board:events")   // or whichever key StorageError named
   ```
   then reload. `migrate()` regenerates missing slices from defaults; a
   missing `events` slice just means the board waits for the next sync
   instead of showing a cached copy.
3. Nuclear option, if you can't get Web Inspector access: **Settings →
   Safari → Advanced → Website Data**, find your board's domain, swipe to
   delete. This wipes *every* `board:*` key at once — notes, settings, chores,
   everything — so only do this after step 1's backup.

### Inspecting the board's own storage (Web Inspector)

Needed for the `localStorage.getItem(...)` commands above, and generally the
most direct way to see what the board itself sees.

1. On the iPad: **Settings → Safari → Advanced → Web Inspector → On.**
2. Connect the iPad to a Mac with a cable, unlock the iPad, trust the
   computer if asked.
3. On the Mac, open Safari → **Develop** menu (enable it first in Safari
   Settings → Advanced → "Show features for web developers" if you don't see
   it) → find the iPad in the device list → the board's page.
4. This opens a full console against the live board, including
   `localStorage`. Exiting Guided Access is not required for this — it only
   inspects the page, it doesn't need to interact with the iPad's screen.

## The typeface looks wrong (system font instead of Archivo)

Cosmetic only, board otherwise fully functional. The header/body typeface
(Archivo) loads from Google Fonts at runtime (`src/styles/shell/Fit.js`'s
`@import`) rather than being bundled with the app — Deferred Defect #10,
`PLAN.md` §7. A board that has never had network on its very first load, or
loses network before that stylesheet fetch completes, falls back to the
system font until network returns and it can load. `index.html` already
preconnects to shave the round trip; fully removing the dependency (bundling
the font instead) means editing `src/styles/shell/Fit.js`, outside this
role's owned paths (`docs/`, deployment configuration) — noted here rather
than fixed, per `PLAN.md` §5's coordination rule.

## Nothing above matches

Check the browser console via Web Inspector (above) for anything logged with
a `[board]` prefix — `ErrorBoundary` and the storage layer both tag their
errors that way. If the deploy itself is suspect, `git log` on `main` and
Vercel's deployment history will show what shipped and when.
