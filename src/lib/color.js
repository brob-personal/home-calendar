/*
  Color
  60% paper, 30% surface grey, 10% the family's pastels.

  Moved verbatim from family-board.jsx:99-176. These are the project's cleanest
  seams — pure, total, and already the target of R13's unit tests (the sat/light
  clamp in variantColor and splitFill's diagonal). Nothing here changed.
*/

export function clampHex(h) {
  const s = String(h || "")
    .replace("#", "")
    .slice(0, 6);
  return `#${s.padEnd(6, "0")}`;
}

export function toRgb(hex) {
  const h = clampHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
}

export function tint(hex, amount) {
  const [r, g, b] = toRgb(hex);
  const m = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

/* ── Sub-colors ──────────────────────────────────────────────────────────
   Google gives every event an optional colorId (1–11). We don't reuse
   Google's actual colors — that would break the person-is-a-color rule.
   Instead each colorId picks a variation *within the owner's hue*, so a
   glance still reads "Brian" while two of Brian's events stay tellable
   apart. Every variation is clamped to the pastel band.
   ──────────────────────────────────────────────────────────────────────── */
export function hexToHsl(hex) {
  let [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

/* hue shift (deg), saturation multiplier, lightness delta */
export const VARIATIONS = [
  { h: 0, s: 1.0, l: 0.0 },
  { h: -14, s: 1.12, l: -0.08 },
  { h: 13, s: 0.84, l: 0.06 },
  { h: -6, s: 0.68, l: -0.03 },
  { h: 21, s: 1.06, l: -0.05 },
  { h: -23, s: 0.9, l: 0.05 },
  { h: 8, s: 1.18, l: -0.1 },
  { h: -11, s: 0.76, l: 0.08 },
  { h: 27, s: 0.88, l: -0.02 },
  { h: -18, s: 1.1, l: -0.06 },
  { h: 4, s: 0.62, l: 0.03 },
];

export const VARIATION_COUNT = VARIATIONS.length;

export function variantColor(baseHex, variant = 0) {
  const v = VARIATIONS[((variant % VARIATION_COUNT) + VARIATION_COUNT) % VARIATION_COUNT];
  let [h, s, l] = hexToHsl(baseHex);
  h = (h + v.h + 360) % 360;
  s = Math.min(0.8, Math.max(0.32, s * v.s));
  l = Math.min(0.88, Math.max(0.64, l + v.l));
  return `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
}

/** One color = flat fill. Two or more = hard diagonal split, one band each. */
export function splitFill(colors, fallback) {
  const cols = colors.filter(Boolean);
  if (cols.length === 0) return fallback;
  if (cols.length === 1) return cols[0];
  const step = 100 / cols.length;
  const stops = cols.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`).join(", ");
  return `linear-gradient(135deg, ${stops})`;
}
