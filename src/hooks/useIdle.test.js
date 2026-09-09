import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useIdle } from "./useIdle.js";

/*
  Deferred Defect #3's regression guard: a settings edit that changes
  `seconds` or `enabled` used to tear down and re-add all three window
  listeners on every render. It should now register them exactly once.
*/
describe("useIdle", () => {
  beforeEach(() => {
    vi.spyOn(window, "addEventListener");
    vi.spyOn(window, "removeEventListener");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the three window listeners once, not on every settings edit", () => {
    const { rerender, unmount } = renderHook(({ seconds, enabled }) => useIdle(seconds, enabled), {
      initialProps: { seconds: 60, enabled: true },
    });

    const countFor = (type) =>
      window.addEventListener.mock.calls.filter(([t]) => t === type).length;

    expect(countFor("pointerdown")).toBe(1);
    expect(countFor("keydown")).toBe(1);
    expect(countFor("touchstart")).toBe(1);

    rerender({ seconds: 30, enabled: true });
    rerender({ seconds: 30, enabled: false });
    rerender({ seconds: 120, enabled: true });

    // Still exactly one registration per event type after three prop changes.
    expect(countFor("pointerdown")).toBe(1);
    expect(countFor("keydown")).toBe(1);
    expect(countFor("touchstart")).toBe(1);
    expect(window.removeEventListener).not.toHaveBeenCalled();

    unmount();
    expect(window.removeEventListener.mock.calls.filter(([t]) => t === "pointerdown")).toHaveLength(1);
  });

  it("still restarts the timer with the latest duration after a settings edit", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ seconds, enabled }) => useIdle(seconds, enabled), {
      initialProps: { seconds: 100, enabled: true },
    });

    rerender({ seconds: 5, enabled: true });
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current[0]).toBe(true);
    vi.useRealTimers();
  });
});
