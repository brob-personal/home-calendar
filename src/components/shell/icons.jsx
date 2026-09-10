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
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="2.4" />
    <path d="M12 3v2.5M12 18.5v2.5M21 12h-2.5M5.5 12H3M18.4 5.6l-1.76 1.76M7.36 16.64l-1.76 1.76M18.4 18.4l-1.76-1.76M7.36 7.36 5.6 5.6" />
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

export const Plus = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M12 5v14M5 12h14" />
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

export const CaretDown = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
  >
    <path d="M5 9l7 7 7-7" />
  </svg>
);

export const Home = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
  >
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6 10v9h12v-9" />
    <path d="M10 19v-5h4v5" />
  </svg>
);
