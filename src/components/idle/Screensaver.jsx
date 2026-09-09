import { useState, useEffect } from "react";

import { fmtClock, fmtTime, DOW_LONG } from "../../lib/date.js";

/*
  Moved verbatim from family-board.jsx:1643-1673.

  R9 owns this next, and everything it needs is already here except the data.
  `photos` is a list of image URLs that comes from settings, and
  DEFAULT_SETTINGS ships it as `[]` with no UI anywhere in the app to
  populate it — which is why the board has never shown a photo. R9's job is
  Settings' folder-id field, src/data/drive.js, and the server-side proxy;
  this component needs no change beyond receiving a non-empty array.

  Preserve on the way through (PLAN.md §R9 item 4): the 30s rotation, the
  scrim, the clock, and the next-event line. And item 5: month art stays the
  fallback, which is the `hasPhoto` branch below — an empty or unreachable
  folder shows the month gradient, not an error.

  The rotation interval depends on `photos` rather than `photos.length`, so a
  settings edit that replaces the array restarts the rotation from the current
  index. Harmless on a screensaver; worth knowing if R9 refetches the list on
  a timer.
*/
export function Screensaver({ now, art, photos, events }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!photos?.length) return;
    const id = setInterval(() => setI((n) => (n + 1) % photos.length), 30000);
    return () => clearInterval(id);
  }, [photos]);

  const next = events
    .filter((e) => e.start > now && !e.allDay)
    .sort((a, b) => a.start - b.start)[0];
  const hasPhoto = Boolean(photos?.length);
  const bg = hasPhoto
    ? {
        backgroundImage: `url(${photos[i]})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { backgroundImage: art.art };

  return (
    <div className={`fb-saver${hasPhoto ? " has-photo" : ""}`} style={bg}>
      {hasPhoto && <div className="fb-saverscrim" />}
      <div className="fb-savertext">
        <span className="fb-saverclock">{fmtClock(now)}</span>
        <span className="fb-saverdate">
          {DOW_LONG[now.getDay()]}, {art.name} {now.getDate()}
        </span>
        {next && (
          <span className="fb-savernext">
            Next up is {next.title} at {fmtTime(next.start)}
          </span>
        )}
      </div>
    </div>
  );
}
