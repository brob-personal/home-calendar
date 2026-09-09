/*
  Avatar.

  .fb-av sizes come from the size prop as inline style, not from these
  rules — the same component renders at 26px in Agenda, 28px in the
  composer, 30px in the footer legend, 38px in a Day lane and 44px in
  Settings. Only the circle geometry, the dimmed-when-filtered-out state
  and the colour dot live here.
*/
export default `
/* Avatar */
.fb-av { position: relative; display: inline-block; flex: none; transition: opacity .15s ease, filter .15s ease; }
.fb-av.is-off { opacity: .38; filter: grayscale(1); }
.fb-avimg, .fb-avinit {
  width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center;
  object-fit: cover; font-weight: 700; letter-spacing: -.01em; color: var(--ink-on-color);
}
.fb-avdot {
  position: absolute; right: -1px; bottom: -1px;
  border-radius: 50%; border-style: solid; border-color: var(--paper);
}
`;
