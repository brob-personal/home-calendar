export default `
.fb-homebtn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 11px; color: var(--mute); background: var(--surface);
}
.fb-homebtn-compact { padding: 6px 7px; gap: 4px; }
.fb-homecount { font-size: 14px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.fb-homepop { min-width: 170px; }
.fb-ddpop-left { left: 0; right: auto; }
.fb-homeopt {
  display: flex; align-items: center; gap: 9px;
  font-size: 14px; font-weight: 600; color: var(--ink); text-align: left;
  padding: 7px 10px; border-radius: 8px;
}
.fb-homeopt.is-off { color: var(--mute); }
.fb-homeopt:hover, .fb-homeopt:focus-visible { background: var(--surface); }
.fb-homereset { color: var(--mute); border-top: 1px solid var(--line); margin-top: 4px; padding-top: 9px; border-radius: 0 0 8px 8px; }
`;
