# Ops docs — R14

This folder is the operator's half of the project. Everything under `src/` and
`api/` is documented for the engineer extending it (see `CONTRACTS.md`,
`BUILD-NOTES.md`, `REFACTOR-NOTES.md`, `WEATHER-NOTES.md` at the repo root);
this folder is for the person turning a factory-state iPad into a running,
pinned board and keeping it that way for months without a developer nearby.

Read in this order the first time:

1. **[DEPLOY.md](./DEPLOY.md)** — stand up the server side once: hosting,
   secrets, the OAuth consent run.
2. **[DEVICE-SETUP.md](./DEVICE-SETUP.md)** — turn the iPad into a wall
   appliance: Auto-Lock, home-screen install, Guided Access.
3. **[BRIGHTNESS-SHORTCUTS.md](./BRIGHTNESS-SHORTCUTS.md)** — optional but
   recommended: automate the screen brightness across the day.
4. **[RECOVERY.md](./RECOVERY.md)** — keep this one bookmarked. What to do
   when the board is blank, stale, or logged out.
5. **[BACKUP-RESTORE.md](./BACKUP-RESTORE.md)** — the board's data lives only
   in the iPad's browser storage. Back it up before you need it.
6. **[SOAK-TEST.md](./SOAK-TEST.md)** — run once before trusting the board to
   run unattended: a multi-day check for memory growth, clock drift, and the
   calendar poll staying correct over time.

Acceptance bar this folder is held to (PLAN.md §R14): **a factory-state iPad
reaches a running, pinned board using these docs alone, with no undocumented
step.**
