/*
  Defaults — moved verbatim from family-board.jsx:72-93.

  This file lands in src/contracts/ because R3 owns that directory and its
  backlog item 4 is "extend DEFAULT_SETTINGS with every field later waves
  need, defaulted and migrated". R2 only relocated the object; not one field
  was added, removed or renamed.

  R3's item 4 names the additions it will make here — `mode`, `calendars`,
  `weather`, `drive`, `sleepStyle` — and two existing fields it must attend
  to:

    - `sleepDim` is a 0-0.4 slider (Settings.jsx). The spec asks for a
      discrete "black or dim" choice, which becomes `sleepStyle`.
    - `wakeTapSeconds` is hardcoded here and only ever *displayed* in
      Settings.jsx's Sleep note. There is no control for it.
*/

export const DEFAULT_MEMBERS = [
  { id: "brian", name: "Brian", color: "#7EB6E8", photo: "", onBoard: true },
  { id: "rachel", name: "Rachel", color: "#F0A3B8", photo: "", onBoard: true },
  { id: "david", name: "David", color: "#8ED9B2", photo: "", onBoard: true },
  { id: "john", name: "John", color: "#F6C58A", photo: "", onBoard: true },
  { id: "tatyana", name: "Tatyana", color: "#C2A8E8", photo: "", onBoard: true },
];

export const DEFAULT_SETTINGS = {
  theme: "paper",
  customPaper: "",
  dayStart: 7,
  dayEnd: 21,
  bedtime: "22:00",
  wakeTime: "06:30",
  sleepDim: 0.05,
  wakeTapSeconds: 90,
  screensaver: true,
  idleMinutes: 6,
  monthArt: true,
  photos: [], // >>> SWAP: image URLs for the photo screensaver
};
