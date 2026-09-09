/*
  Day — rebuilt by R7 (PLAN.md §R7 item 1). The old rules laid out a
  horizontal transpose: `.fb-lane` was a row, `.fb-lanetrack` ran left-to-right,
  `.fb-axis` sat underneath as a strip. These replace that with the same
  vertical grid WeekView uses — `.fb-hourline`, `.fb-nowrow`/`.fb-nowdot`,
  `.fb-gutter`/`.fb-hours`/`.fb-hour` are all declared once, in week.js, and
  reused here unchanged so Day and Week read as one system (item 2). Only the
  column head (`.fb-dhead`, people instead of days) and the block/track rules
  below (`.fb-dcol`, `.fb-dblock` — member-tinted, not shared-fill) are Day's
  own.
*/
export default `
/* Day */
.fb-day { display: flex; flex-direction: column; gap: 10px; height: 100%; }
.fb-allday { display: flex; gap: 8px; flex-wrap: wrap; flex: none; }
.fb-alldaychip {
  font-size: 13px; font-weight: 600; padding: 6px 12px;
  background: var(--surface); border-radius: 8px; color: var(--mute);
}
.fb-dayhead { display: flex; flex: none; padding-right: 6px; }
.fb-dhead {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 9px;
  padding: 2px 0 8px; color: var(--ink); border-bottom: 1px solid var(--line);
}
.fb-dname { font-size: 15px; font-weight: 600; letter-spacing: -.015em; }
.fb-daybody { flex: 1; overflow-y: auto; overflow-x: hidden; }
.fb-daygrid { display: flex; position: relative; }
.fb-dcol { position: relative; flex: 1; border-left: 1px solid var(--line); }
.fb-dcol:last-child { border-right: 1px solid var(--line); }
.fb-laneempty {
  position: absolute; left: 14px; top: 10px;
  font-size: 13px; font-weight: 500; color: var(--mute); opacity: .75;
}
.fb-dblock {
  position: absolute; left: 6px; right: 6px; z-index: 2;
  border-radius: 8px; padding: 5px 11px;
  display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
  color: #24262B; overflow: hidden; text-align: left;
}
.fb-blocktitle {
  font-size: 14px; font-weight: 700; letter-spacing: -.015em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}
.fb-blocktime { font-size: 11px; font-weight: 600; opacity: .66; }
`;
