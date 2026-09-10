/* Month. */
export default `
/* Month */
.fb-monthwrap { display: flex; flex-direction: column; height: 100%; gap: 7px; }
.fb-monthtoolbar { display: flex; justify-content: flex-end; }
.fb-monthweather {
  width: var(--tap-min); height: var(--tap-min);
  display: grid; place-items: center; border-radius: 999px; border: none;
  background: var(--paper); color: var(--ink);
}
.fb-monthweather[aria-pressed="true"] { box-shadow: inset 0 0 0 2px var(--now); }
.fb-monthhead {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--mute); padding: 0 6px;
}
.fb-grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; min-height: 0; }
.fb-cell {
  background: var(--paper); border-radius: 9px;
  padding: 6px 7px; display: flex; flex-direction: column; gap: 4px;
  text-align: left; overflow: hidden;
}
.fb-cell.is-outside { opacity: .42; }
.fb-cell.is-today { box-shadow: inset 0 0 0 2px var(--now); }
.fb-cellnumrow { display: flex; align-items: baseline; gap: 5px; }
.fb-cellnum { font-size: 15px; font-weight: 700; letter-spacing: -.025em; }
.fb-cellhilo {
  font-size: 10px; font-weight: 600; color: var(--mute); font-variant-numeric: tabular-nums;
}
.fb-cellevents { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.fb-cellev {
  font-size: 11px; font-weight: 600; color: var(--ink-on-color);
  padding: 2px 6px; border-radius: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fb-cellmore { font-size: 10px; font-weight: 600; color: var(--mute); padding-left: 2px; }
`;
