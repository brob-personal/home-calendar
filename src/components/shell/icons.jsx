/*
  The four inline SVG icons, moved verbatim from family-board.jsx:1703-1726.

  Hand-drawn paths on a 24x24 box, 1.7-1.8 stroke, `stroke="currentColor"` so
  each one inherits its container's colour. There is no icon dependency and
  there should not be one — R6's backlog item 2 requires its five weather
  icons to match this idiom rather than pulling in a library.
*/

export const Gear = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
  >
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2 5.4 5.4" />
  </svg>
);

export const Cross = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const Chevron = ({ dir }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

export const Pencil = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
  >
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
    <path d="M14.5 6.5l3 3" />
  </svg>
);
