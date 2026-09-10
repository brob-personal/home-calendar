/*
  The weather condition icons plus Clock (a column-header glyph, not a
  condition) — PLAN.md §R6 item 2: "Match the existing hand-drawn inline-SVG
  idiom (Gear ...); do not add an icon dependency." Same box, same stroke:
  24x24 viewBox, no fill, stroke="currentColor" at 1.7 so every icon inherits
  its container's colour exactly like ../shell/icons.jsx does. Kept in this
  file rather than that one — this directory is R6's exclusively;
  ../shell/icons.jsx is R2's.
*/

export const Clock = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="9.4" />
    <path d="M12 7v5.2l3.6 2.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Sunny = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="4.6" />
    <path
      d="M12 1.6v2.9M12 19.5v2.9M22.4 12h-2.9M4.5 12H1.6M19.4 4.6l-2 2M6.6 17.4l-2 2M19.4 19.4l-2-2M6.6 6.6l-2-2"
      strokeLinecap="round"
    />
  </svg>
);

export const PartlyCloudy = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="8.3" cy="7.8" r="3.1" />
    <path
      d="M8.3 2.6v1.7M14.4 7.8h-1.7M4.5 5.1l1.2 1.2M12.1 5.1l-1.2 1.2"
      strokeLinecap="round"
    />
    <path d="M7.6 20.4h9.3a3.5 3.5 0 0 0 .5-6.96 4.9 4.9 0 0 0-9.34-1.82A4.1 4.1 0 0 0 4 15.9a3.5 3.5 0 0 0 3.6 4.5z" />
  </svg>
);

export const Cloudy = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M6.4 18.4h11a4 4 0 0 0 .6-7.94A5.5 5.5 0 0 0 7.5 8.8 4.6 4.6 0 0 0 2.8 13.4a4 4 0 0 0 3.6 5z" />
  </svg>
);

export const Rain = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M6 14.4h11a3.6 3.6 0 0 0 .5-7.15A5 5 0 0 0 8 6 4.2 4.2 0 0 0 2.9 10.1 3.6 3.6 0 0 0 6 14.4z" />
    <path d="M8 18.1l-1.5 3M12.3 18.1l-1.5 3M16.6 18.1l-1.5 3" strokeLinecap="round" />
  </svg>
);

export const Snow = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M6 13.7h11a3.6 3.6 0 0 0 .5-7.15A5 5 0 0 0 8 5.2 4.2 4.2 0 0 0 2.9 9.3 3.6 3.6 0 0 0 6 13.7z" />
    <path
      d="M8.3 17.9v4M6.3 18.9l4 2M10.3 18.9l-4 2M14.6 17.9v4M12.6 18.9l4 2M16.6 18.9l-4 2"
      strokeLinecap="round"
    />
  </svg>
);
