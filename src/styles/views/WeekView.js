/*
  Week.

  .fb-gutter at 56px is the hour column R7's backlog item 2 wants Day to
  reuse, so that Day and Week read as one system. If that becomes a shared
  TimeGutter component, this rule is the one that moves — coordinate through
  R0, because extracting it means touching WeekView.
*/
export default `
/* Week */
.fb-week { display: flex; flex-direction: column; height: 100%; }
.fb-weekhead { display: flex; flex: none; padding-right: 6px; }
.fb-gutter { width: 56px; flex: none; }
.fb-whead {
  flex: 1; display: flex; align-items: baseline; justify-content: center; gap: 6px;
  padding: 2px 0 8px; color: var(--mute); border-bottom: 1px solid var(--line);
}
.fb-whead.is-today { color: var(--ink); border-bottom: 2px solid var(--now); }
.fb-wdow { font-size: 13px; font-weight: 600; }
.fb-wnum { font-size: 21px; font-weight: 700; letter-spacing: -.035em; }
.fb-weekbody { flex: 1; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none; }
.fb-weekbody::-webkit-scrollbar { display: none; }
.fb-weekgrid { display: flex; position: relative; }
.fb-hours { display: flex; flex-direction: column; }
.fb-hour {
  display: flex; align-items: flex-start; justify-content: flex-end;
  padding-right: 9px; font-size: 12px; font-weight: 600; color: var(--mute);
  font-variant-numeric: tabular-nums; transform: translateY(-6px);
}
.fb-wcol { position: relative; flex: 1; border-left: 1px solid var(--line); }
.fb-wcol:last-child { border-right: 1px solid var(--line); }
.fb-wcol.is-today { background: var(--surface); }
.fb-hourline { border-bottom: 1px solid var(--line); }
.fb-nowrow {
  position: absolute; left: 0; right: 0; height: 2px;
  background: var(--now); z-index: 4; pointer-events: none;
}
.fb-nowdot {
  position: absolute; left: -4px; top: -3px;
  width: 8px; height: 8px; border-radius: 50%; background: var(--now);
}
.fb-wblock {
  position: absolute; left: 2px; right: 2px; z-index: 2;
  border-radius: 6px; padding: 3px 6px; overflow: hidden;
  display: flex; color: var(--ink-on-color); text-align: left;
}
.fb-wblock.is-stacked { flex-direction: column; justify-content: flex-start; align-items: flex-start; }
.fb-wblock.is-compact { flex-direction: row; align-items: flex-start; gap: 5px; }
.fb-wbtitle {
  font-size: 12px; font-weight: 700; letter-spacing: -.012em; line-height: 1.15;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fb-wblock.is-compact .fb-wbtitle { flex: 0 1 auto; min-width: 0; }
.fb-wbtime { font-size: 10px; font-weight: 600; opacity: .64; white-space: nowrap; flex: none; }
`;
