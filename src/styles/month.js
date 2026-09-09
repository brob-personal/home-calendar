/* Month. */
export default `
/* Month */
.fb-monthwrap { display: flex; flex-direction: column; height: 100%; gap: 7px; }
.fb-monthhead {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--mute); padding: 0 6px;
}
.fb-grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; min-height: 0; }
.fb-cell {
  background: var(--surface); border-radius: 9px;
  padding: 6px 7px; display: flex; flex-direction: column; gap: 4px;
  text-align: left; overflow: hidden;
}
.fb-cell.is-outside { opacity: .42; }
.fb-cell.is-today { box-shadow: inset 0 0 0 2px var(--now); }
.fb-cellnum { font-size: 15px; font-weight: 700; letter-spacing: -.025em; }
.fb-cellevents { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.fb-cellev {
  font-size: 11px; font-weight: 600; color: #24262B;
  padding: 2px 6px; border-radius: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fb-cellmore { font-size: 10px; font-weight: 600; color: var(--mute); padding-left: 2px; }
`;
