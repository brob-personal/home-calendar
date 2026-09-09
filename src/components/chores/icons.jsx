/*
  Two more inline SVGs in the hand-drawn idiom of ../shell/icons.jsx — R6's
  WeatherIcons took the same approach rather than pulling in an icon
  dependency (PLAN.md §R6 item 2's own rule, general enough to reuse here).
*/

export const Plus = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Check = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);
