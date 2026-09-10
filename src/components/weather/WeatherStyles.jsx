import { memo } from "react";

/*
  Weather's own stylesheet, injected the same way ../shell/BoardStyles.jsx
  fixes Deferred Defect #8 — a module-constant string behind a memo()
  boundary, so it renders once per mount rather than on every clock tick.

  Deliberately not folded into src/styles/** and src/components/shell/
  BoardStyles.jsx. PLAN.md §2 marks src/styles/** as R5's exclusive path, and
  src/styles/styles.contract.test.js asserts BOARD_CSS is byte-identical to
  the original prototype string — a fixture with no weather feature in it, so
  any addition there fails that test for a reason that has nothing to do with
  what it guards. Weather predates R5's tokens.css pass, so there is nothing
  yet to fold into. Staying self-contained inside src/components/weather/ —
  R6's exclusive path — means this never needed a PLAN.md-routed contract
  change to land (§5 rule 2).

  The three colours below are the same var(--surface) / var(--ink) /
  var(--mute) custom properties every other component reads off .fb-root
  (App.jsx) — nothing new is invented, this file just doesn't travel through
  ../../styles/index.js to get them.

  .fb-weatherpanel is `position: fixed`, not `absolute`. .fb-device
  (../../styles/fit.js) carries a CSS transform (the <Fit> scaler), and a
  transform establishes the containing block for its fixed-position
  descendants — so a fixed box here resolves against the 1080x810 canvas, not
  the real viewport, and cannot overflow it regardless of where the header
  lands on the page.

  The reduced-motion override for `@keyframes fb-weather-grow` needs no rule
  of its own: src/styles/motion.js's `.fb-root * { animation-duration: .01ms
  !important }` already matches every descendant of .fb-root, including this
  one, and it is guaranteed to lose the animation race only in the direction
  that matters — a reduced-motion user sees no growth animation regardless of
  which stylesheet loads first, because !important does not care about source
  order between two different <style> tags.
*/
const CSS = `
.fb-weather { position: relative; }
.fb-weatherchip {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
  padding: 8px 14px; border-radius: 999px;
  background: var(--surface); color: var(--ink);
}
.fb-weatherchip svg { flex: none; }

.fb-weatherpanel {
  position: fixed; top: 84px; right: 24px; z-index: 30;
  width: 300px; max-height: 560px;
  display: flex; flex-direction: column; gap: 10px;
  padding: 16px; border-radius: 16px;
  background: var(--paper); color: var(--ink);
  box-shadow: 0 20px 60px rgba(24,28,36,.24);
  transform-origin: top right;
  animation: fb-weather-grow .16s ease-out;
}
@keyframes fb-weather-grow {
  from { transform: scale(.85); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.fb-weatherhilo { display: flex; gap: 16px; font-size: 20px; font-weight: 700; flex: none; }
.fb-weatherlo { color: var(--mute); }

.fb-weathercols {
  display: flex; align-items: center; gap: 10px;
  padding: 0 2px; color: var(--mute); flex: none;
}
.fb-weathercols .fb-weatherrowtime,
.fb-weathercols .fb-weatherrowtemp { display: flex; }
.fb-weathercols svg { width: 16px; height: 16px; }

.fb-weatherlist {
  margin: 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
}
.fb-weatherrow {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 2px; font-size: 14px; border-bottom: 1px solid var(--line);
}
.fb-weatherrow:last-child { border-bottom: none; }
.fb-weatherrowtime { width: 46px; color: var(--mute); flex: none; }
.fb-weatherrowtemp { width: 50px; font-weight: 700; font-variant-numeric: tabular-nums; flex: none; }
.fb-weatherrowprecip { color: var(--mute); font-variant-numeric: tabular-nums; }
.fb-weatherrow-sunrise .fb-weatherrowlabel,
.fb-weatherrow-sunset .fb-weatherrowlabel,
.fb-weatherrow-uv .fb-weatherrowlabel { color: var(--mute); font-style: italic; }

.fb-weatherstale { color: var(--mute); font-size: 11px; }
`;

export const WeatherStyles = memo(function WeatherStyles() {
  return <style>{CSS}</style>;
});
