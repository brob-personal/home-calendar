/*
  Sleep.

  .fb-veil is opaque and the inner block carries the opacity, which is why
  a dim of 5% still shows a legible clock against a black board rather than
  a 5%-opaque board. R3's sleepStyle ("black" | "dim") turns that slider
  into the discrete choice the spec actually asks for; these rules already
  support both ends of it.
*/
export default `
/* Sleep */
.fb-veil {
  position: absolute; inset: 0; z-index: 60;
  background: var(--veil-bg); display: grid; place-items: center; transition: opacity .8s ease;
}
.fb-veilinner {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  color: var(--ink-on-dark); transition: opacity .8s ease;
}
.fb-veilclock { font-size: 74px; font-weight: 300; letter-spacing: -.045em; font-variant-numeric: tabular-nums; }
.fb-veildate { font-size: 18px; font-weight: 400; }
`;
