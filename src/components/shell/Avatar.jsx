import { tint } from "../../lib/color.js";
import { initialOf } from "../../lib/text.js";

/*
  Moved verbatim from family-board.jsx:682-705.

  Photo if there is one, tinted initial if not, and always the colour dot in
  the corner — the dot is the person-is-a-colour rule made literal, and it is
  the only place a member's raw hue appears at full saturation. `off` drives
  the greyscale-and-fade state the footer legend uses for filtered-out people.

  Sizes are passed in, not chosen here: 26px in Agenda, 28px in the composer,
  30px in the legend, 38px in a Day lane, 44px in Settings. R11's chore
  columns are to reuse this component per PLAN.md §R11 item 2.
*/
export function Avatar({ member, size = 40, off = false }) {
  const d = Math.round(size * 0.34);
  return (
    <span className={`fb-av${off ? " is-off" : ""}`} style={{ width: size, height: size }}>
      {member.photo ? (
        <img className="fb-avimg" src={member.photo} alt="" />
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
