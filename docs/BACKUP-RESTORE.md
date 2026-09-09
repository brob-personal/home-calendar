# Backup and restore

**Everything the board remembers lives only in the iPad's `localStorage`** —
there is no server-side database. The Vercel deployment holds one secret
(the Google refresh token, see `DEPLOY.md`) and nothing else; members,
settings, sticky notes, the event cache, and chore/routine state all live on
the device alone, under key names `src/contracts/schema.js` declares
(`STORE_KEYS`), namespaced `board:` (`src/lib/store.js`'s `NAMESPACE`). If
that iPad is lost, reset, or has its Safari data cleared, that state is gone
unless you backed it up first.

There is no in-app export/import button (out of scope for this role — it
would mean editing `Settings.jsx`, which R14 doesn't own). This is a manual
procedure using Safari's Web Inspector, the same connection
[RECOVERY.md](./RECOVERY.md) uses for diagnosis.

## What gets backed up

All six `board:`-prefixed keys: `members`, `settings`, `notes`, `events`,
`tasks`, `routines`. `events` is just a sync cache — it repopulates from
Google within one poll cycle either way — but it's harmless to include and
simpler to back up everything than to special-case it.

## Back up

1. Set up Web Inspector once, per [RECOVERY.md](./RECOVERY.md)'s "Inspecting
   the board's own storage" section — Mac connected, board's page open in
   Safari's Develop menu.
2. In the console, run:
   ```js
   copy(JSON.stringify(Object.fromEntries(
     Object.keys(localStorage)
       .filter((k) => k.startsWith("board:"))
       .map((k) => [k, localStorage.getItem(k)])
   )));
   ```
   Safari's console `copy()` puts the result on the **Mac's** clipboard (not
   the iPad's) — that's deliberate, it's how the backup gets off the device.
3. Paste into a text file on the Mac and save it somewhere durable — outside
   this repo, since a real backup contains this household's actual calendar
   data, notes, and chore assignments. A dated filename
   (`board-backup-2026-09-09.json`) is enough; there's no format beyond raw
   JSON to worry about.

Do this before any storage-clearing recovery step, before handing the iPad
off for a repair, and occasionally on a normal schedule — there's no
automatic trigger, this is a manual habit.

## Restore

1. Open the saved backup file, copy its full JSON contents.
2. Web Inspector console, same setup as above. Run, with the copied JSON
   pasted in place of the placeholder:
   ```js
   const backup = /* paste the saved JSON object here, replacing this comment */;
   Object.entries(backup).forEach(([k, v]) => localStorage.setItem(k, v));
   location.reload();
   ```
3. The board reloads and reads the restored state through the normal
   `store.get` → `migrate()` path — same code path a normal boot uses, so a
   backup taken on an older build still loads correctly; `migrate()` exists
   exactly to carry an old blob forward (`PLAN.md` §R3).

## Moving to a replacement iPad

Same restore procedure, run once on the new device before installing it per
[DEVICE-SETUP.md](./DEVICE-SETUP.md): open the board's URL in a plain Safari
tab first (not yet added to the home screen), run the restore script against
that tab, confirm the board shows the right data, *then* proceed with
"Add to Home Screen" and the rest of device setup.
