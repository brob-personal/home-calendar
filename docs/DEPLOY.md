# Production deploy

The board is a static Vite bundle plus a handful of Vercel serverless
functions under `api/**` (R1's choice, `BUILD-NOTES.md` item 1 — `vercel.json`
is the only file that would need to change for Fly or Render, nothing in
`src/` is provider-specific). This is the one-time setup to get a working,
authenticated, publicly-reachable board.

Do this from a laptop, once. Nothing here runs on the iPad.

## 1. Create the Google OAuth client

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or
   reuse) a project, then **APIs & Services → Library** and enable:
   - Google Calendar API
   - Google Drive API
2. **APIs & Services → OAuth consent screen.** Type: External. Add the Google
   account the board should read (yours) as a test user — this app is never
   published/verified, so it stays in "Testing" indefinitely, which is fine:
   only the test-user account can ever complete consent.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
   Application type **Web application**. Leave redirect URIs empty for now —
   you'll add the real one after the first deploy, once you know the domain.

Keep this tab open; you'll need the **Client ID** and **Client secret** below.

## 2. First deploy (secrets not wired yet)

1. Push this repo to GitHub if it isn't already.
2. In [Vercel](https://vercel.com/), **Add New → Project**, import the repo.
   Framework preset auto-detects as Vite (`vercel.json` pins it explicitly).
   Deploy once with no env vars set — it will build, and the board will load
   in the browser showing mock/empty data. That's expected; this step only
   exists to learn your deployment's domain.
3. Note the domain, e.g. `family-board-xyz.vercel.app`. If you're attaching a
   custom domain, do that now (**Settings → Domains**) and use the custom
   domain from here on instead.

## 3. Generate the device secret

```
openssl rand -hex 32
```

This is `BOARD_DEVICE_SECRET`. It identifies the board to the API — it does
not authorize a Google account, and unlike the refresh token below it is safe
to have inlined into the client bundle (`VITE_BOARD_DEVICE_SECRET` gets the
same value; see `.env.example` for why).

## 4. Set environment variables

**Vercel → Project → Settings → Environment Variables**, production
environment. Set every name `.env.example` declares:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from step 1 |
| `GOOGLE_CLIENT_SECRET` | from step 1 |
| `GOOGLE_REDIRECT_URI` | `https://<your-domain>/api/auth/google` |
| `GOOGLE_REFRESH_TOKEN` | leave empty for now — step 6 fills this in |
| `GOOGLE_SCOPES` | `https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly` |
| `BOARD_DEVICE_SECRET` | from step 3 |
| `ALLOWED_ORIGIN` | `https://<your-domain>` — no trailing slash, no wildcard |
| `VITE_BOARD_DEVICE_SECRET` | same value as `BOARD_DEVICE_SECRET` |
| `VITE_API_BASE_URL` | leave empty — same-origin `/api` is correct on Vercel |
| `DRIVE_FOLDER_ID` | optional seed; the Photos field in Settings is the real path |
| `VITE_WEATHER_DEFAULT_LAT` / `_LON` / `_LABEL` | optional seed; Settings is the real path |

Now go back to Google Cloud Console (step 1) and add the **Authorized
redirect URI**: `https://<your-domain>/api/auth/google`, exactly, no
trailing slash. Save.

Redeploy (**Deployments → ⋯ → Redeploy**) so the new env vars take effect.

## 5. Confirm the deploy is healthy

```
curl https://<your-domain>/api/health
```

Expect `"ok": true` and every `config.*` flag `true` **except**
`refreshTokenConfigured`, which is still `false` — that's step 6. If any other
flag is `false`, re-check the matching env var in step 4.

## 6. Run the OAuth consent flow once

This is the only step a human has to click through in a browser, and the only
time the refresh token is ever visible.

1. Visit, **signed into the Google account the board should read**:
   ```
   https://<your-domain>/api/auth/google?secret=<BOARD_DEVICE_SECRET>
   ```
2. Approve consent for Calendar and Drive.
3. Google redirects back and the page shows the refresh token exactly once,
   in a `<pre>` block. Copy it.
   - If instead it says *"Google returned no refresh token"* — this account
     already granted consent previously without `prompt=consent` being
     honored. Revoke prior access at
     [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
     and repeat step 6.
4. Paste the copied value into `GOOGLE_REFRESH_TOKEN` (step 4's table) and
   redeploy.
5. Confirm: `curl https://<your-domain>/api/health` now shows
   `refreshTokenConfigured: true`.
6. Confirm the mint actually works end to end:
   ```
   curl -H "X-Board-Secret: <BOARD_DEVICE_SECRET>" https://<your-domain>/api/auth/refresh
   ```
   Expect `{"ok":true,"expiresAt":"..."}`. This never returns the token
   itself — see `api/auth/refresh.js`'s own header comment.

## 7. Point a real calendar at the board

`Settings.calendars[mode]` starts empty (R10's note in `PLAN.md`) — nothing
downstream assumes a calendar exists until one is added. Open the board once
from a regular browser (not yet the wall iPad), open Settings, and add at
least one calendar under both Personal and Roommate mode as needed. See
`CONTRACTS.md` for the calendar-set shape if you're editing it by hand instead.

At this point the board is fully live: real events, real photos (once a Drive
folder id is set), real weather (once a location is set). Proceed to
[DEVICE-SETUP.md](./DEVICE-SETUP.md) to put it on the wall.

## Rotating secrets later

- **`BOARD_DEVICE_SECRET`**: generate a new one (step 3), update
  `BOARD_DEVICE_SECRET` *and* `VITE_BOARD_DEVICE_SECRET` together, redeploy.
  Both must match or the API starts rejecting the board's own requests.
- **`GOOGLE_REFRESH_TOKEN`**: only needed if it's revoked or expires from
  disuse. Repeat step 6.
- **`GOOGLE_CLIENT_SECRET`**: rotate in Google Cloud Console, update the env
  var, redeploy. The refresh token stays valid — it's tied to the consent
  grant, not the client secret.

No secret above is ever returned in a response body, written to
`localStorage`, or reaches the iPad — see `.env.example`'s own header and
`api/health.js`'s comment for why the health check only reports booleans.
