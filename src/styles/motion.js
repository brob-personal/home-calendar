/*
  Last chunk in the sheet, and it has to stay last: it overrides transition
  and animation durations declared anywhere above it.

  PLAN.md §R5 item 6 requires preserving this block and the :focus-visible
  outlines in shell/Root.js.
*/
export default `
@media (prefers-reduced-motion: reduce) {
  .fb-root *, .fb-root *::before, .fb-root *::after {
    transition-duration: .01ms !important; animation-duration: .01ms !important;
  }
}
`;
