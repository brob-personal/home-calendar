/* Moved verbatim from family-board.jsx:96-97. */
export const uid = () =>
  globalThis.crypto?.randomUUID?.() || `id${Math.random().toString(36).slice(2, 10)}`;
