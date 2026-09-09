/*
  Screensaver.

  `.fb-saver` with no photo shows the month gradient and dark text;
  `.has-photo` adds the scrim and flips the text to white. R9 feeds this from
  a real Drive folder and must keep the month-art fallback working when the
  folder is empty or unreachable.
*/
export default `
/* Screensaver */
.fb-saver { position: absolute; inset: 0; z-index: 50; }
.fb-saverscrim {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,.66), rgba(0,0,0,.1) 55%, transparent);
}
.fb-savertext {
  position: absolute; left: 46px; bottom: 42px;
  display: flex; flex-direction: column; gap: 3px; color: #2A2D33;
}
.fb-saver.has-photo .fb-savertext { color: #fff; }
.fb-saverclock { font-size: 104px; font-weight: 800; line-height: .86; letter-spacing: -.05em; font-variant-numeric: tabular-nums; }
.fb-saverdate { font-size: 23px; font-weight: 500; }
.fb-savernext { font-size: 16px; font-weight: 500; opacity: .72; margin-top: 6px; }
`;
