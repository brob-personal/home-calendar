import { useEffect, useState } from "react";
import { tint } from "../../lib/color.js";
import { initialOf } from "../../lib/text.js";
import { getFirstDrivePhotoUrl } from "../../data/drive.js";

/*
  Moved verbatim from family-board.jsx:682-705.

  Photo if there is one, tinted initial if not, and always the colour dot in
  the corner — the dot is the person-is-a-colour rule made literal, and it is
  the only place a member's raw hue appears at full saturation. `off` drives
  the greyscale-and-fade state the footer legend uses for filtered-out people.

  Sizes are passed in, not chosen here: 26px in Agenda, 28px in the composer,
  30px in the legend, 38px in a Day lane, 44px in Settings. R11's chore
  columns are to reuse this component per PLAN.md §R11 item 2.

  `photoDriveFolderId` takes priority over the plain `photo` URL when both
  are set: it is resolved once per folder id (../../data/drive.js caches the
  result), and while it is unresolved or resolves to nothing — no folder,
  an empty folder, or an unreachable one — this falls back to `photo`, then
  to the initial, exactly as it did before this field existed.
*/
export function Avatar({ member, size = 40, off = false }) {
  const d = Math.round(size * 0.34);
  const folderId = member.photoDriveFolderId || "";
  const [driveUrl, setDriveUrl] = useState(null);

  useEffect(() => {
    setDriveUrl(null);
    if (!folderId) return;
    let cancelled = false;
    getFirstDrivePhotoUrl(folderId).then((url) => {
      if (!cancelled) setDriveUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  const photo = driveUrl || member.photo;

  return (
    <span className={`fb-av${off ? " is-off" : ""}`} style={{ width: size, height: size }}>
      {photo ? (
        <img className="fb-avimg" src={photo} alt="" />
      ) : (
        <span
          className="fb-avinit"
          style={{ background: tint(member.color, 0.66), fontSize: Math.round(size * 0.42) }}
        >
          {initialOf(member.name)}
        </span>
      )}
      <span
        className="fb-avdot"
        style={{
          width: d,
          height: d,
          background: member.color,
          borderWidth: Math.max(2, size * 0.06),
        }}
      />
    </span>
  );
}
