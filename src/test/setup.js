import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

/*
  jsdom ships no ResizeObserver, and <Fit> (family-board.jsx:409) constructs one
  on mount to scale the 1080x810 canvas. Without a stub every render throws.

  The stub deliberately never fires its callback: jsdom reports 0x0 for
  getBoundingClientRect, so a measurement would compute scale 0 and tell us
  nothing. Fit's initial state is already scale 1, which is what the board
  resolves to on the real device. Tests that need real layout belong in R13's
  fixed-viewport 1080x810 visual pass, not in jsdom.
*/
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/*
  The prototype's storage seam calls window.storage (family-board.jsx:28) — an
  artifact host API that exists in no browser. Both bodies already swallow the
  failure and fall back to memory, so tests pass without this, but stubbing it
  keeps the console clean and documents the seam.

  R3 replaces this with localStorage behind the same async interface.
*/
if (!("storage" in globalThis)) {
  const memory = new Map();
  globalThis.storage = {
    async get(key) {
      return memory.has(key) ? { value: memory.get(key) } : null;
    },
    async set(key, value) {
      memory.set(key, value);
    },
  };
}
