/*
  Day — rebuilt by R7 (PLAN.md §R7 item 1), reconciled with R5's token pass
  when the two branches landed back to back.

  R7 rotated the view to spec: `.fb-lane`/`.fb-lanetrack`/`.fb-axis` (a row
  per person, time left-to-right, an hour strip underneath) are gone,
  replaced by the same vertical grid WeekView uses — `.fb-gutter`/`.fb-hours`/
  `.fb-hour` via the shared `<TimeGutter>`, plus `.fb-hourline` and
  `.fb-nowrow`/`.fb-nowdot`, all still declared once in week.js and reused
  here unchanged (item 2). Only the column head (`.fb-dayhead`/`.fb-dhead`/
  `.fb-dname`, people instead of days) and the block/track rules below
  (`.fb-daybody`/`.fb-daygrid`/`.fb-dcol`, `.fb-dblock` — member-tinted, not
  shared-fill) are Day's own.

  That rewrite retired R5's magic-number derivation for this file: `.fb-axis`
  no longer exists, so tokens.js no longer carries --lane-name-w/--lane-gap/
  --axis-margin — there is nothing left to keep in sync. R5's other
  contribution survives: `.fb-dblock`'s text colour reads var(--ink-on-color)
  rather than the #24262B literal R7's version hardcoded, same as every
  other event block across Day/Week/Month.
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
.fb-daybody { flex: 1; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none; }
.fb-daybody::-webkit-scrollbar { display: none; }
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
  display: flex; align-items: flex-start; justify-content: flex-start;
  color: var(--ink-on-color); overflow: hidden; text-align: left;
}
.fb-dblock.is-stacked { flex-direction: column; justify-content: flex-start; align-items: flex-start; }
.fb-dblock.is-compact { flex-direction: row; gap: 6px; }
.fb-blocktitle {
  font-size: 14px; font-weight: 700; letter-spacing: -.015em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}
.fb-dblock.is-compact .fb-blocktitle { flex: 0 1 auto; min-width: 0; max-width: none; }
.fb-blocktime { font-size: 11px; font-weight: 600; opacity: .66; white-space: nowrap; flex: none; }
`;
