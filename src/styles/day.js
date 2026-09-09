/*
  Day.

  Everything here is about to be rewritten. R7's mandate is to rotate the view
  — time onto the vertical left axis, people across the top — which is the
  transpose of what these rules lay out: `.fb-lane` is a row, `.fb-lanetrack`
  runs horizontally, and `.fb-axis` is a strip underneath. R2 moved the rules
  unchanged so R7 inherits a working baseline to diff against.

  `.fb-axis { margin-left: 164px }` is the magic-number duplication named in
  R5's backlog item 3: 164 is `.fb-lanename`'s 150px width plus `.fb-lane`'s
  14px gap, and nothing enforces that. Change either number and the hour
  labels silently stop lining up with the tracks. R5 expresses it as a derived
  custom property.
*/
export default `
/* Day */
.fb-day { display: flex; flex-direction: column; gap: 10px; height: 100%; }
.fb-allday { display: flex; gap: 8px; flex-wrap: wrap; flex: none; }
.fb-alldaychip {
  font-size: 13px; font-weight: 600; padding: 6px 12px;
  background: var(--surface); border-radius: 8px; color: var(--mute);
}
.fb-lanes { flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.fb-lane { display: flex; align-items: stretch; gap: 14px; flex: 1; min-height: 0; }
.fb-lanename { width: 150px; flex: none; display: flex; align-items: center; gap: 11px; }
.fb-lanetext { font-size: 17px; font-weight: 600; letter-spacing: -.015em; }
.fb-lanetrack { position: relative; flex: 1; border-radius: 10px; }
.fb-laneempty {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  font-size: 13px; font-weight: 500; color: var(--mute); opacity: .75;
}
.fb-block {
  position: absolute; top: 5px; bottom: 5px; min-width: 38px;
  border-radius: 8px; padding: 0 11px;
  display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
  color: #24262B; overflow: hidden; text-align: left;
}
.fb-blocktitle {
  font-size: 15px; font-weight: 700; letter-spacing: -.015em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}
.fb-blocktime { font-size: 11px; font-weight: 600; opacity: .66; }
.fb-nowline {
  position: absolute; top: 0; bottom: 0; width: 2px; border-radius: 2px;
  background: var(--now); z-index: 3; pointer-events: none;
}
.fb-axis { position: relative; height: 18px; margin-left: 164px; flex: none; }
.fb-tick {
  position: absolute; transform: translateX(-50%);
  font-size: 12px; font-weight: 600; color: var(--mute); font-variant-numeric: tabular-nums;
}
`;
