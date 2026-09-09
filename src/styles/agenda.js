/*
  Agenda, plus `.fb-empty`.

  `.fb-empty` is shared: Agenda uses it for "nothing scheduled from here on",
  and Day uses it for the everyone-is-hidden state. It stays in this chunk
  because that is where the prototype declared it, and cascade order is what
  makes this split provably identical to the string it came from.
*/
export default `
/* Agenda */
.fb-agenda { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
.fb-agroup { display: flex; gap: 20px; }
.fb-aday { width: 86px; flex: none; display: flex; align-items: baseline; gap: 8px; }
.fb-adow { font-size: 13px; font-weight: 600; color: var(--mute); }
.fb-anum { font-size: 28px; font-weight: 800; letter-spacing: -.04em; }
.fb-alist { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.fb-arow { display: flex; align-items: center; gap: 13px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.fb-abar { width: 6px; height: 26px; border-radius: 3px; flex: none; }
.fb-atime { width: 70px; flex: none; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.fb-atitle { font-size: 16px; font-weight: 500; }
.fb-awhere { font-size: 13px; color: var(--mute); }
.fb-awho { margin-left: auto; display: flex; gap: 5px; }
.fb-empty { padding: 40px 0; font-size: 16px; color: var(--mute); }
`;
