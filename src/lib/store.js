/*
  Storage — artifact storage here; swap both bodies for localStorage on your
  own host and nothing else in the app changes.
  >>> SWAP

  Moved verbatim from family-board.jsx:20-39. R2 relocated it and changed
  nothing: `window.storage` is an artifact-host API that exists in no browser,
  so on a real host every call falls into the catch and the board runs from
  memory (BUILD-NOTES.md, R1 note 6).

  R3 owns this file next: backlog item 3 swaps both bodies for localStorage
  behind the same async interface and surfaces failures instead of swallowing
  them, so a broken board is visible rather than mysteriously amnesiac.
*/
export const store = {
  async get(key) {
    try {
      const r = await window.storage.get(`board:${key}`);
      return r ? JSON.parse(r.value) : null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      await window.storage.set(`board:${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable — run from memory */
    }
  },
};
