# R3 — Contracts & Data-Layer Architect

What landed, what is now guaranteed, and what each later role needs to know.
`PLAN.md` is the execution source of truth; this is the note R3 leaves behind, the
way `BUILD-NOTES.md` is R1's and `REFACTOR-NOTES.md` is R2's.

**The one-line summary.** Dates survive JSON, storage is real and no longer silent,
every shape a later wave consumes is declared and defaulted, and the source seam has
all five methods.

---

## 1. The files

| File | What it is |
|---|---|
| `src/contracts/schema.js` | Every typedef, plus the runtime normalizers that enforce them. `SCHEMA_VERSION`, `STORE_KEYS`, `MODES`, `SLEEP_STYLES`, `WEATHER_CONDITIONS`, `VARIATION_COUNT`. |
| `src/contracts/serialize.js` | The Date fix. `toJSON` / `fromJSON` / `roundTrip`. |
| `src/contracts/migrate.js` | `migrate(persisted)` plus the per-slice normalizers and the `MIGRATIONS` step list. |
| `src/contracts/defaults.js` | `DEFAULT_SETTINGS` extended with every field waves 1–3 need, defaulted to inert. |
| `src/contracts/source.js` | The five-method source interface, `defineSource()`, `inRange()`. |
| `src/contracts/index.js` | Barrel. Import from here in feature code. |
| `src/lib/store.js` | `localStorage`, versioned envelope, `StorageError`. |
| `src/data/mock.js` | Now implements all five methods; seed data unchanged. |
| `src/data/index.js` | The seam, with the interface re-exported for R8. |
| `src/state/BoardContext.js` | The board-data bundle on a context. |

Tests: `schema.test.js`, `serialize.test.js`, `migrate.test.js`,
`persistence.integration.test.jsx`, `src/lib/store.test.js`,
`src/data/source.contract.test.js`. 101 of them, and R13 inherits the lot.

---

## 2. The Date problem, and the shape of the fix

The landmine (`PLAN.md` §1) was never in one function. It was in the seam between
three that were each individually right: the source hands over live `Date`s, the
store writes JSON, and the views call `.getHours()`. `JSON.stringify` turns a Date
into an ISO string and `JSON.parse` hands back a string, so the first round-trip
broke every `minutesInto` and `sameDay` at once.

Values are now tagged rather than guessed at:

```js
new Date("2026-09-09T14:00:00Z")   ->   { "$date": "2026-09-09T14:00:00.000Z" }
```

**Why tagged and not a list of date-shaped field names.** A reviver that knows
`start` and `end` are dates works exactly until a role adds a date somewhere else —
and four of them do: `Task.doneAt`, `Routine.anchor`, and `WeatherSnapshot`'s
`fetchedAt`, `sunrise`, `sunset` and `uvPeak.at`. A field list would have to be
edited by every one of those roles, in R3's file, which is the cross-role coupling
`PLAN.md` §5 rule 3 exists to prevent. The tag travels with the value instead.

One subtlety worth knowing before you touch `dateReplacer`: a `JSON.stringify`
replacer receives the value *after* the holder's own `toJSON()` has run, and
`Date.prototype.toJSON` returns a string — so by the time a naive replacer sees the
value, the Date is already gone. It reads the pre-`toJSON` value back off `this`,
which is why it is a `function` and not an arrow.

Not handled, deliberately: `Map`, `Set`, `RegExp`, `BigInt`, `undefined`, cyclic
references. Nothing in the contracts uses them. Adding one later is additive.

---

## 3. Storage

Same async interface, three things different behind it.

`window.storage` — an artifact-host API that exists in no browser — is gone, and with
it the two empty `catch` blocks that made a board forget everything on reload without
saying so. Every failure now raises a `StorageError` carrying `op`, `key`, `code` and
`cause`, where `code` is one of `unavailable` / `quota` / `corrupt` / `io`.

Writes are wrapped and stamped:

```js
{ v: 1, at: "2026-09-09T18:04:00.000Z", data: <the slice> }
```

`at` is for R14's recovery notes: when a board is stale, the first question is how
stale, and the answer should not depend on the app still working. An **unwrapped**
value — anything written before this envelope existed — reads as version 0, which is
exactly what `migrate()` expects. That is how a pre-R3 blob loads without loss.

`store.get` returns `null` only for a key that was never written. A key holding
something unreadable **throws** and the blob is **not** deleted: self-healing there
would turn a diagnosable corruption into an amnesiac board that looks fine.

`useBoardData` collects these into `storageErrors`, and exposes `storageError` (the
first) for **R12** to render.

---

## 4. Settings — the new fields

All defaulted to inert, so the board behaves exactly as it did before. Verified by
R2's smoke tests, which still pass untouched.

| Field | Default | Owner |
|---|---|---|
| `sleepStyle` | `"dim"` | the discrete black-or-dim choice SCOPING asks for |
| `mode` | `"personal"` | R10 |
| `calendars` | `{ personal: [], roommate: [] }` | R8 fills, R10 switches |
| `weather` | `{ label: "", lat: null, lon: null, units: "F" }` | R6 |
| `drive` | `{ folderId: "" }` | R9 |
| `wakeTapSeconds` | `90` | already existed; now clamped and documented |

`Member` gained `modes: string[]`, defaulting to both, so **R10** can hold a separate
roster per mode. The five family members arrive in both modes so the board still
renders somebody in Roommate mode before R10 lands a roster editor.

**On `sleepStyle` vs `sleepDim`.** `sleepDim` survives as the opacity used when
`sleepStyle` is `"dim"`, so no existing board changes appearance. The migration
*derives* the choice once from the old slider: below 0.02 becomes `"black"`, because
`SleepVeil` floors its opacity at `Math.max(opacity, 0.02)` so the clock stays
readable — which means a slider dragged to 0 was a user asking for black and getting
as close as the prototype could go. **There is no control for it yet**; `Settings.jsx`
is not R3's file. See Deferred Defect #16.

---

## 5. The source interface

```js
list(range?) -> Event[]        // range optional and advisory; the array is the caller's
create(draft) -> Event         // the source assigns the id; add the *returned* event to state
update(id, patch) -> Event     // patch semantics; rejects an unknown id; `id` is not patchable
remove(id) -> void             // idempotent
subscribe(fn) -> unsubscribe   // full list after every change; unsubscribing twice is safe
```

`update` was the missing half of the app — every existing mutation path is
create-or-destroy and there is no edit anywhere, in any view. `subscribe` is what
makes an always-on display correct rather than merely fresh.

Build with `defineSource(impl, name)`. It throws at construction, naming the missing
methods, rather than failing the first time somebody edits an event on the wall with
no console open.

`src/data/source.contract.test.js` is written against the interface, not against the
mock: `runs("google", () => createGoogleSource(fakeApiBase))` is one line, and R8
inherits all fourteen cases.

---

## 6. What each later role should read

**R6 — Weather.** `WeatherSnapshot` is frozen in `schema.js`, `fetchedAt` included so
you can show stale readings rather than an error. `WEATHER_CONDITIONS` is closed at
five and `normalizeCondition()` folds everything else to `sunny` — pinned as spec, not
as a shortcut. Location and units are in `settings.weather`, `lat`/`lon` null until
configured. `WeatherSnapshot.daily` (added for the Month view's 16-day forecast) holds
one `WeatherDay` per day, `daily[0]` always mirroring the top-level today-only fields.
`useWeather(settings)` now takes `settings` directly rather than reading it off
`useBoard()` — App.jsx makes the one call and hands the reading to both `Header` and
`MonthView` as a prop, so a second consumer doesn't mean a second poller hitting
Open-Meteo.

**R7 — Day View.** `update` exists now: `useBoardData` exposes `updateEvent(id, patch)`,
patch semantics, so your detail sheet sends back only what it showed.

**R8 — Calendar sync.** Read `src/data/index.js`; the sketch there is updated for the
five methods. `normalizeEvent` accepts ISO strings for `start`/`end`, so the
`new Date(...)` wrappers in the old sketch are unnecessary — and dropping them removes
the place where a malformed payload became an Invalid Date nobody checked. Your item 5
offline cache is already wired: `store.set("events", …)` round-trips live Dates, and
`useBoardData` paints the cache before `list()` resolves. The per-mode calendar map is
`settings.calendars[mode]` as `CalendarLink[]`.

**R9 — Drive.** `settings.drive.folderId`. `settings.photos` still feeds `Screensaver`
unchanged.

**R10 — Modes.** `settings.mode` is persisted and validated; `MODES` is the closed
union. `Member.modes` is your per-mode roster — landed narrowed to `["personal"]` on
the five defaults; Roommate mode starts empty and is populated from Settings. Landed
as `src/state/ModeContext.js`, beside `BoardContext` as planned, but exporting a
plain `useModeState(members, settings, setSettings)` hook rather than reading
`useBoard()` internally — App.jsx already holds those three directly and would
otherwise be consuming a context it is itself about to provide, the same reason
`useBoardPalette` sits beside `PaletteContext` instead of inside it. `useMode()` is
still there for everyone else — Settings' mode toggle, R11's chores tab.

**R11 — Chores.** `Task` and `Routine` are frozen in `schema.js` and `STORE_KEYS`
reserves the `tasks` and `routines` keys. `Routine` carries `anchor`, `cadence`,
`everyN` and `memberIds` so rotation can be a pure function of the rule and the date
rather than accumulated state — your item 7 asks for deterministic and testable, and
`anchor` is how you get it. Add the two default slices to `DEFAULT_BOARD` when you
land them.

**R12 — Hardening.** `storageError` / `storageErrors` on the board bundle is your
failure data; `code` distinguishes "storage is full" from "storage failed". Defect #7
is still open on purpose — `source.list()` still has no try/catch — but the board now
has cached events to keep showing while it happens.

**R13 — QA.** 101 new tests. `persistence.integration.test.jsx` is the acceptance
criterion end to end and the pattern for mocking the seam: `vi.mock("../data/index.js")`
with a module-level `active` source, and `list: () => new Promise(() => {})` as a dead
network, which is also the only way to observe the cache — a live source correctly
overwrites it the moment it answers.

**R14 — Ops.** `store` writes `at` on every slice for your recovery notes, and
`store.remove(key)` is the "clear one corrupt slice" step. Backup and restore is
`STORE_KEYS` plus `toJSON` / `fromJSON`.

---

## 7. Decisions a reviewer might question

1. **`BoardContext.js`, not `.jsx`.** `PLAN.md` §2 wrote `.jsx`, but the module
   exports no components — same reason `PaletteContext.js` does not, and the same
   `react-refresh/only-export-components` warning avoided. The plan named the module,
   not the extension.

2. **Two files R3 does not own were edited.** `src/hooks/useBoardData.js`, because
   Defect #13 is assigned to R3 and lives there, and `src/App.jsx`, for two additive
   lines publishing the existing bundle on `BoardContext` — every existing consumer
   keeps its props, so no behaviour changed. Flagged here rather than assumed.

3. **`migrate()` both steps *and* normalizes.** A version step alone cannot protect
   the board, because the hazard is not only an older shape — it is also a blob edited
   by hand, one written by a build that shipped a field this one dropped, and one whose
   theme was renamed. Those have no version to key off.

4. **Unknown settings keys are preserved, not stripped.** "Load without loss" has to
   hold in both directions: a board briefly rolled back to an older build must not
   permanently discard the newer build's fields.

5. **The mock returns copies from `list()`.** It used to hand out its internal array,
   so a caller's `.push()` or `.sort()` rewrote the source's state from the outside —
   silently, and only on the mock, which is exactly the kind of difference that stops
   a mock being a valid stand-in. Caught by the contract test.

---

## 8. Two bugs the tests caught, worth remembering

**`Number(null)` is `0`, and `0` is finite.** A plain `Number.isFinite` guard turns
"unset" into zero, which is how `weather.lat: null` became a real coordinate in the
Gulf of Guinea. `clampNum` now checks absent before numeric. The idempotence test
found it.

**`Date.UTC` truncates a fractional hour.** `at(10.5)` is 10:00, not 10:30, so a test
fixture written that way tests nothing. Minutes are passed explicitly in
`source.contract.test.js`.
