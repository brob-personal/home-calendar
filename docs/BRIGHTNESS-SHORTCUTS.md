# Brightness automations (iOS Shortcuts)

**This is separate from the in-app sleep mode.** Settings → Sleep
(`bedtime` / `wakeTime` / Black-or-Dim, `src/components/settings/Settings.jsx`)
controls a black or dimmed **overlay drawn inside the board** during
configured night hours — `<SleepVeil>`. What follows here instead controls
the **iPad's own screen brightness**, at the OS level, on a sunrise/sunset
schedule. The two are independent and meant to stack: overnight, the OS
brightness automation below turns the panel down *and* the in-app veil goes
black or dim; during the day, the OS brightness automation turns the panel
back up while the in-app veil is simply absent (outside `bedtime`–`wakeTime`).

This whole section is optional — the board works with the iPad at a fixed
brightness — but a wall panel at full brightness all night is both
uncomfortable in a dark room and needless wear, and this is stock iOS with no
extra app.

## Why two automations, not three

The spec asks for three states — dim at sunset, bright at sunrise, near-full
(not 100%) through the day. Two Shortcuts automations cover all three: the
sunrise automation sets brightness to near-full **and that level holds for
the rest of daylight**, since nothing else touches brightness until sunset's
automation fires. No separate midday automation is needed.

**Near-full, not 100%** is deliberate, per PLAN.md's own wording — this panel
runs at that brightness for the sunlit half of every day, indefinitely;
leaving a couple of percent of headroom instead of the absolute maximum is
the cheap insurance against running the backlight flat-out for months
straight. There's no required number — 85–90% is a reasonable choice.

## Setup

1. Open the **Shortcuts** app on the iPad (stock, preinstalled).
2. **Automation** tab (bottom) → **+** → **Create Personal Automation**.
3. **Sunset** automation:
   - Trigger: **Time of Day → Sunset**. (Shortcuts computes this from the
     iPad's location — grant Shortcuts location access if prompted, otherwise
     the trigger can't compute a time and won't fire.)
   - Add Action → **Set Brightness** → drag to a low level, e.g. **20%**.
   - At the bottom, turn **Ask Before Running OFF**. This step is not
     optional on a Guided-Access-pinned device — a confirmation banner has no
     way to be dismissed if the only app allowed on screen isn't Shortcuts.
   - **Done**.
4. **Sunrise** automation: repeat step 3 with trigger **Time of Day →
   Sunrise** and **Set Brightness** at a near-full level, e.g. **90%**. Same
   "Ask Before Running OFF" — same reason.
5. Leave the iPad running as normal (Guided Access active, board on screen —
   see [DEVICE-SETUP.md](./DEVICE-SETUP.md)). Both automations fire in the
   background regardless of what's on screen or whether Guided Access is
   active; they don't need Shortcuts to be the foreground app.

## Verifying it actually works

Don't wait for an actual sunrise/sunset to find out these are misconfigured:

1. In the Shortcuts app, open one of the two automations and tap **Run** at
   the bottom of its detail view. If brightness changes immediately, the
   action itself works, independent of the time trigger.
2. Manually change the device's date/time close to a trigger time (**Settings
   → General → Date & Time**, briefly turn off "Set Automatically") to confirm
   the automation itself fires under its real trigger. Turn automatic
   date/time back on afterward — a wall clock that's manually wrong will also
   throw off the board's own now-line and countdown ticker.

## If brightness stops adjusting

Most likely cause: iOS silently disabled a background automation, which it
occasionally does for automations that haven't run in a while or after a
system update. Open **Shortcuts → Automation**, confirm both are listed and
enabled (a greyed-out toggle means it's off), and re-run the "Run" test above.
