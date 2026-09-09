/*
  Header — 92px.

  .fb-icon was 42px, one of the six selectors on R12's 44pt list (backlog
  item 1) — raised to --tap-min. See tap-target-audit.md for the full list.
*/
export default `
/* Header — 92px */
.fb-head { display: flex; align-items: flex-end; gap: 20px; height: 92px; flex: none; }
.fb-datestack { display: flex; align-items: baseline; gap: 13px; }
.fb-dow { font-size: 27px; font-weight: 500; letter-spacing: -.015em; color: var(--mute); }
.fb-num { font-size: 82px; font-weight: 800; line-height: .82; letter-spacing: -.045em; }
.fb-headmeta { padding-bottom: 5px; }
.fb-month { font-size: 19px; font-weight: 600; letter-spacing: -.012em; }
.fb-sub { font-size: 14px; color: var(--mute); margin-top: 2px; }
.fb-headright { margin-left: auto; display: flex; align-items: center; gap: 12px; padding-bottom: 5px; }
.fb-clock { font-size: 32px; font-weight: 700; letter-spacing: -.035em; font-variant-numeric: tabular-nums; }
.fb-chip {
  font-size: 13px; font-weight: 600; padding: 8px 14px;
  background: var(--surface); border-radius: 999px; color: var(--mute);
}
.fb-icon {
  display: grid; place-items: center; width: var(--tap-min); height: var(--tap-min);
  border-radius: 11px; color: var(--mute); background: var(--surface);
}
`;
