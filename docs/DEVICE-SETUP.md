# Device setup — iPad 7th gen (A2197)

Do this once per physical iPad, after [DEPLOY.md](./DEPLOY.md) has a working
URL. Every step below is in stock iPadOS Settings or Safari — no
configuration profile, no MDM, no developer mode.

## 1. Install to the home screen

The board is meant to run as a standalone web app, not a Safari tab — the
`<meta apple-mobile-web-app-capable>` tags in `index.html` only take effect
once it's launched this way; opened as a plain Safari tab it still works, but
shows Safari's address bar and can be swiped closed accidentally.

1. On the iPad, open **Safari** (not Chrome — only Safari honors the
   home-screen-app meta tags on iOS) and go to your board's URL.
2. Let it fully load once — confirm you see real events, not a blank canvas.
3. Tap the **Share** icon → **Add to Home Screen** → **Add**.
4. Close the Safari tab. Launch the board from the new home-screen icon
   instead. It should open with no address bar, no Safari chrome — full
   screen, exactly the 1080×810 canvas centered and scaled by `<Fit>`.

From here on, **always launch from the home-screen icon**, never from a
Safari tab or bookmark — a plain Safari tab is a distinct instance with its
own `localStorage`-adjacent behavior around tab suspension and doesn't
benefit from the standalone display mode.

## 2. Auto-Lock → Never

A wall board that locks itself is not a wall board.

**Settings → Display & Brightness → Auto-Lock → Never.**

This is the single most important setting on this list — everything else is
about making the *one* app on screen safe and correct; this is what keeps
anything on screen at all.

## 3. Guided Access — pin the board as the only app

Guided Access locks the device to a single app, disables the home button /
swipe-up gesture, and can disable touch in specific screen regions. This is
what makes the board tamper-resistant on a wall.

1. **Settings → Accessibility → Guided Access → On.**
2. **Passcode Settings → Set Guided Access Passcode.** Pick something the
   household can use to exit later — this is not a security boundary against
   a determined adult, it's a childproofing/toddler-proofing measure.
3. (Optional but recommended) **Display Auto-Lock**, inside Guided Access
   settings, → **Never**. This is a *second*, Guided-Access-scoped Auto-Lock
   setting independent of step 2's system-wide one; setting both closes the
   gap where Guided Access's own timeout could still sleep the screen.
4. Open the board from its home-screen icon (step 1).
5. **Triple-click the top (side) button.** Guided Access starts. You can
   circle out any screen regions that shouldn't respond to touch (not needed
   for the board — every control is meant to be tappable) then tap **Start**
   top-right.
6. Confirm: try the iPad's normal gestures (swipe up from the bottom edge,
   swipe down for Control Center). Both should do nothing. The board is now
   the only thing this iPad can do.

**To exit later** (for a software update, or to redo any step above):
triple-click the top button again, enter the Guided Access passcode, tap
**End** top-left.

## 4. Cache behavior — what a redeploy actually does

`vercel.json` sets two different cache policies:

- `/index.html` and `/` — `max-age=0, must-revalidate`. The shell is never
  served stale; every load re-checks with the server.
- `/assets/*` (the hashed JS/CSS bundle) — `max-age=31536000, immutable`. A
  given filename never changes contents, so it's cached for a year; a new
  deploy produces new hashed filenames instead of overwriting old ones.

Net effect: **the next full reload of the app picks up a new deploy
automatically** — there is no separate "clear cache" step. The catch is that
the board is a standalone PWA with no reload button and no pull-to-refresh
(`overscroll-behavior: none` is deliberate — see `index.html`). To pick up a
change after a redeploy:

1. Exit Guided Access (step 3's reverse).
2. Double-click the home button (or swipe up and pause, on gesture-only
   models) to see the app switcher, swipe the board's card up to close it.
3. Reopen from the home-screen icon.
4. Re-enter Guided Access (step 3, from "Open the board").

There's no harm in leaving the board running for weeks between updates —
nothing here forces a periodic reload, and none is scheduled. If you want one
anyway (e.g. to bound how long a rare `localStorage` inconsistency can persist
before a fresh load re-derives it), that's a manual repeat of the four steps
above; there's no in-app or Shortcuts equivalent to closing and reopening a
standalone PWA.

## Done when

The board is on screen, showing live data, Auto-Lock is off, and Guided
Access is active — the iPad now does exactly one thing and can't be
accidentally backed out of it. Proceed to
[BRIGHTNESS-SHORTCUTS.md](./BRIGHTNESS-SHORTCUTS.md) for the day/night
brightness automation, or straight to normal use.
