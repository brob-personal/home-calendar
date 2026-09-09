/*
  Theme data — moved verbatim from family-board.jsx:41-70.

  Five light themes plus ACCENT_NOW and the twelve month gradients. Note for
  R5, which owns src/styles/** and whose acceptance criterion is "zero
  hardcoded colour literals outside tokens.css": these literals are the ones
  that criterion is about. R2 relocated them without touching a value, because
  they are read from JS (settings.theme picks a THEMES key, MONTH_ART indexes
  by month) and turning them into CSS custom properties is a design-system
  decision, not a mechanical move. The palette reaches the DOM through the
  `--paper` / `--surface` / `--line` / `--ink` / `--mute` / `--now` custom
  properties set in App.jsx.
*/

export const THEMES = {
  paper: {
    label: "Paper",
    paper: "#FCFCFD",
    surface: "#F0F1F4",
    line: "#E2E4E9",
    ink: "#23262D",
    mute: "#787E8A",
  },
  cream: {
    label: "Cream",
    paper: "#FDFBF6",
    surface: "#F3EFE6",
    line: "#E7E1D4",
    ink: "#2A2721",
    mute: "#7E7768",
  },
  mist: {
    label: "Mist",
    paper: "#FBFCFD",
    surface: "#EDF1F5",
    line: "#DEE5EC",
    ink: "#22282F",
    mute: "#75808D",
  },
  sage: {
    label: "Sage",
    paper: "#FBFCFA",
    surface: "#EDF2EC",
    line: "#DFE7DE",
    ink: "#242A25",
    mute: "#77827A",
  },
  blush: {
    label: "Blush",
    paper: "#FDFBFC",
    surface: "#F5EFF1",
    line: "#EAE0E4",
    ink: "#2A2427",
    mute: "#82757B",
  },
};

export const ACCENT_NOW = "#E0574F"; // the current-time line, and nothing else

export const MONTH_ART = [
  {
    name: "January",
    art: "radial-gradient(120% 90% at 12% 0%, #CFE0F0 0%, transparent 62%), radial-gradient(95% 75% at 88% 100%, #E4EDF5 0%, transparent 65%), linear-gradient(170deg, #F4F8FC, #E6EEF6)",
  },
  {
    name: "February",
    art: "radial-gradient(115% 85% at 82% 8%, #DCD4EE 0%, transparent 62%), radial-gradient(100% 78% at 8% 92%, #F0E4EF 0%, transparent 62%), linear-gradient(160deg, #F8F5FC, #EBE4F4)",
  },
  {
    name: "March",
    art: "radial-gradient(120% 85% at 22% 12%, #D6E8D2 0%, transparent 60%), radial-gradient(92% 72% at 90% 88%, #EDF0DA 0%, transparent 62%), linear-gradient(175deg, #F7FAF4, #E9F1E6)",
  },
  {
    name: "April",
    art: "radial-gradient(112% 88% at 72% 0%, #CFE6EA 0%, transparent 58%), radial-gradient(100% 76% at 12% 95%, #DCEBD6 0%, transparent 62%), linear-gradient(165deg, #F5FAFA, #E6F1EC)",
  },
  {
    name: "May",
    art: "radial-gradient(120% 85% at 18% 8%, #D5EAC9 0%, transparent 60%), radial-gradient(95% 75% at 88% 90%, #F3EDC4 0%, transparent 60%), linear-gradient(170deg, #F8FBF2, #EBF3DF)",
  },
  {
    name: "June",
    art: "radial-gradient(112% 82% at 78% 4%, #FAE9BC 0%, transparent 56%), radial-gradient(100% 80% at 8% 92%, #D8EBCA 0%, transparent 62%), linear-gradient(165deg, #FCF9EC, #EFF4E0)",
  },
  {
    name: "July",
    art: "radial-gradient(120% 85% at 28% 6%, #FBDDB4 0%, transparent 58%), radial-gradient(92% 72% at 92% 88%, #F8CDB8 0%, transparent 60%), linear-gradient(170deg, #FDF6EC, #F7E7DA)",
  },
  {
    name: "August",
    art: "radial-gradient(115% 82% at 80% 10%, #F8E3B4 0%, transparent 58%), radial-gradient(100% 78% at 10% 90%, #EFDCC0 0%, transparent 62%), linear-gradient(168deg, #FDF8EC, #F4EADA)",
  },
  {
    name: "September",
    art: "radial-gradient(120% 88% at 20% 8%, #F3D2B6 0%, transparent 58%), radial-gradient(95% 72% at 90% 92%, #EADFC0 0%, transparent 60%), linear-gradient(172deg, #FCF6EF, #F2E7D8)",
  },
  {
    name: "October",
    art: "radial-gradient(115% 85% at 76% 6%, #F1C4AC 0%, transparent 56%), radial-gradient(100% 80% at 10% 94%, #E7C6C4 0%, transparent 60%), linear-gradient(168deg, #FBF1EC, #F2DFD8)",
  },
  {
    name: "November",
    art: "radial-gradient(120% 85% at 16% 12%, #E4D6C2 0%, transparent 60%), radial-gradient(92% 72% at 88% 88%, #DCDCE2 0%, transparent 62%), linear-gradient(174deg, #F9F6F1, #ECE8E4)",
  },
  {
    name: "December",
    art: "radial-gradient(115% 88% at 74% 8%, #CBDCEE 0%, transparent 58%), radial-gradient(100% 78% at 12% 92%, #E2E8EE 0%, transparent 60%), linear-gradient(166deg, #F5F9FC, #E7EDF4)",
  },
];
