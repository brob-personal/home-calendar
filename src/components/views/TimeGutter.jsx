import { fmtTime } from "../../lib/date.js";

/*
  Shared hour column — PLAN.md §R7 item 2: "Reuse WeekView's hour gutter ...
  Consider extracting a shared TimeGutter." Extracted so Day and Week render
  the same 34px-per-hour math from one place instead of two copies drifting
  apart. Both views still own their own grid/track markup; this is only the
  label column, styled by the existing `.fb-gutter`/`.fb-hours`/`.fb-hour`
  rules in styles/week.js.
*/
export function TimeGutter({ hours, hourH }) {
  return (
    <div className="fb-gutter fb-hours">
      {hours.map((h) => (
        <span className="fb-hour" style={{ height: hourH }} key={h}>
          {fmtTime(new Date(2000, 0, 1, h))}
        </span>
      ))}
    </div>
  );
}
