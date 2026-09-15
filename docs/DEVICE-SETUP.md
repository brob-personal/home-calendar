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
   instead. It should open with no address bar, no Safari chrome, and no grey
   border — the board should reach all four edges of the glass. `<Fit>` maps
   the 900×675 canvas onto the iPad's 1080×810 panel at a uniform 1.2×, so it
   fills the screen exactly and renders 20% larger than its own units
   (`src/lib/canvas.js` is the one knob if it ever needs to be larger or
   smaller again).

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

## 5. Diagnostics

Settings → **Display diagnostics** is where the board reports on itself. It
shows the running build's commit SHA and build time, every width and height the
platform will report, the resolved safe-area insets, the rectangles of all four
layout boxes with all four edges, the transform actually applied to the canvas,
and the scale the code computed alongside every signal that fed it.

The row worth knowing is **glass check**. It compares where `.fb-fit`'s bottom
edge actually is against how tall the screen says it is, and it is the only
check in the board that measures the page against the *device* rather than
against another part of the page:

- `delta 0  PASS` — the board reaches the bottom of the glass. This is the
  expected reading on the wall iPad.
- `delta 20  FAIL` — the grey band along the bottom is back. That number is in
  CSS px, so at this panel's 2x it is half the band you can see.
- `UNKNOWN` — the check could not run, because `screen.availHeight` was
  unavailable. Not a pass.

**Colour probe** recolours every layer that could paint an edge and removes the
month gradient above them, so a stray edge names its own owner: **magenta** is
the frame (`.fb-fit`), **yellow** the board root, **cyan** the stage,
**orange** the body, **lime** outside the body altogether. If an edge stays
neutral grey under the probe, *nothing in the page paints it* — the page either
never receives those pixels or does not get the last word on them, and no CSS
length in this repository will move it.

The button closes the sheet when it turns the probe on, because the sheet
covers the board and the board is the thing being looked at. Open Settings
again and the same button reads **Colour probe off**. That matters here: a
reload is the only other way out of it, and a reload behind Guided Access is
the four-step dance in §4.

If you are reporting anything about how the board looks, include the SHA from
this panel — the board cannot be reloaded casually, so a photograph with no
build identity attached cannot be tied to the code that produced it.

> **Retired.** Until #60 the board also carried an always-on build badge in the
> bottom-left corner and a tap gesture in the top-left — three taps for a
> full-screen readout, four for the colour probe. Both existed because the grey
> band had survived eight fixes and needed to be diagnosed from a step ladder.
> The band is fixed, and a working appliance should not carry a pill over its
> own corner or watch every tap in the page. The readout they delivered is the
> Settings panel above, unchanged.

## Done when

The board is on screen, showing live data, Auto-Lock is off, and Guided
Access is active — the iPad now does exactly one thing and can't be
accidentally backed out of it. Proceed to
[BRIGHTNESS-SHORTCUTS.md](./BRIGHTNESS-SHORTCUTS.md) for the day/night
brightness automation, or straight to normal use.
