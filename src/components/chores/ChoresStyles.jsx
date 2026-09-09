import { memo } from "react";

/*
  Chores' own stylesheet, self-contained inside src/components/chores/ for
  the same reason WeatherStyles.jsx gives for staying out of src/styles/**:
  that tree is R5's exclusive path, and folding a whole new tab's layout into
  it would be a PLAN.md-routed contract change this role doesn't need to
  make when the component tree it's styling is entirely its own. A
  module-constant string behind memo() so it renders once per mount rather
  than on every clock tick, the same BoardStyles.jsx / WeatherStyles.jsx
  pattern.

  Reuses rather than reintroduces the shared vocabulary already loaded
  globally by the time this ever mounts: `.fb-input`, `.fb-pill`,
  `.fb-avpill`, `.fb-ghost`, `.fb-primary`, `.fb-check`, `.fb-sheetfoot` all
  come from src/styles/shell/Sheet.js (Composer.jsx already depends on the
  same global availability). Only the layout this tab actually invents —
  columns, cards, the drop-ready affordance — gets a rule here.

  `--tap-min` (tokens.js) sizes the checkbox and column-header hit targets;
  everything else in the board that predates R5's audit is R12's to fix, but
  new UI has no excuse to ship below the line it already knows about.
*/
const CSS = `
.fb-chores { display: flex; gap: 14px; height: 100%; min-height: 0; }

.fb-chorebank, .fb-chorecol {
  display: flex; flex-direction: column; gap: 8px;
  background: var(--surface); border-radius: 14px;
  padding: 10px; min-height: 0;
  transition: box-shadow .12s ease, background-color .12s ease;
}
.fb-chorebank { width: 260px; flex: none; }
.fb-chorecols { display: flex; gap: 12px; flex: 1; min-width: 0; overflow-x: auto; }
.fb-chorecol { width: 200px; flex: none; }

.fb-chorebank.is-dropready, .fb-chorecol.is-dropready {
  box-shadow: 0 0 0 2px var(--now) inset;
}

.fb-chorecolhead {
  display: flex; align-items: center; gap: 8px;
  min-height: var(--tap-min);
  padding: 6px 10px; border-radius: 10px;
  border: 2px solid transparent;
  background: var(--paper); font-weight: 700; font-size: 14px;
  text-align: left;
}
.fb-chorebankhead { justify-content: center; color: var(--mute); }

.fb-chorelist {
  display: flex; flex-direction: column; gap: 6px;
  overflow-y: auto; min-height: 40px; flex: 1;
}
.fb-choreempty {
  color: var(--mute); font-size: 13px; text-align: center; padding: 12px 4px;
}

.fb-chorecard {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 10px;
  background: var(--paper); cursor: grab;
  border: 2px solid transparent;
}
.fb-chorecard.is-selected { border-color: var(--now); }
.fb-chorecard.is-done { opacity: .5; }
.fb-chorecard.is-done .fb-choretitle { text-decoration: line-through; }

.fb-chorecheck {
  width: var(--tap-min); height: var(--tap-min); flex: none;
  display: flex; align-items: center; justify-content: center;
  border-radius: 999px; border: 2px solid var(--line);
  background: var(--surface); color: var(--ink);
}
.fb-chorecard.is-done .fb-chorecheck { background: var(--now); border-color: var(--now); color: #fff; }

.fb-choreemoji2 { font-size: 18px; flex: none; }
.fb-choretitle { flex: 1; font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fb-chorerecur { color: var(--mute); flex: none; font-size: 15px; }

.fb-choreadd { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; border-top: 1px solid var(--line); }
.fb-choreaddrow { display: flex; gap: 6px; align-items: center; }
.fb-choreaddrow .fb-input { flex: 1; }

.fb-choreemoji { display: flex; flex-wrap: wrap; gap: 4px; }
.fb-choreemojibtn {
  width: 32px; height: 32px; border-radius: 8px; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface);
}
.fb-choreemojibtn.is-on { background: var(--paper); box-shadow: 0 0 0 2px var(--now) inset; }

.fb-choreroutinebtn { align-self: flex-start; font-size: 13px; }
`;

export const ChoresStyles = memo(function ChoresStyles() {
  return <style>{CSS}</style>;
});
