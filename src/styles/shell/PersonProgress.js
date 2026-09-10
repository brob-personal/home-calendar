/*
  PersonProgress — deliberately tiny: a 3px track and a 10px fraction, so it
  reads as a quiet detail next to an avatar rather than competing with it.
*/
export default `
.fb-pprog { display: flex; align-items: center; gap: 5px; }
.fb-pprogtrack {
  width: 32px; height: 3px; border-radius: 2px;
  background: var(--line); overflow: hidden; flex: none;
}
.fb-pprogfill { display: block; height: 100%; border-radius: 2px; opacity: .7; }
.fb-pprogfrac {
  font-size: 10px; font-weight: 600; color: var(--mute);
  font-variant-numeric: tabular-nums; flex: none;
}
`;
