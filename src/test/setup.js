import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

/*
  jsdom ships no ResizeObserver. MonthView (src/components/views/MonthView.jsx)
  constructs one to measure its grid; without a stub those renders throw.

  The stub deliberately never fires its callback: jsdom reports 0x0 for
  getBoundingClientRect, so a measurement would tell us nothing. Tests that
  need real layout belong in R13's fixed-viewport 1080x810 visual pass, not in
  jsdom.

  <Fit> used to be the other caller, and the reason this stub had to never
  fire — a 0x0 measurement there computed scale 0. It no longer constructs an
  observer at all: it reads window.innerWidth/innerHeight, which jsdom does
  report, so src/components/shell/Fit.test.jsx can set a viewport and assert
  the scale that falls out of it.
*/
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/*
  The prototype's storage seam calls window.storage (src/lib/store.js) — an
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

/*
  jsdom ships no layout engine, so it has no Element.prototype.scrollIntoView
  either. TimeField (src/components/shell/TimeField.jsx) calls it on the
  active row when its popover opens; without a stub every open() in a test
  throws "scrollIntoView is not a function". A no-op is enough — like Fit's
  ResizeObserver stub above, there is no real scroll position to assert on
  under jsdom anyway.
*/
if (!("scrollIntoView" in Element.prototype)) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
