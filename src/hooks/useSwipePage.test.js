import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useSwipePage } from "./useSwipePage.js";

function swipe(handlers, from, to) {
  act(() => {
    handlers.onPointerDown({ clientX: from.x, clientY: from.y });
    handlers.onPointerUp({ clientX: to.x, clientY: to.y });
  });
}

describe("useSwipePage", () => {
  it("pages forward on a leftward swipe past the threshold", () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipePage(onSwipe));
    swipe(result.current, { x: 500, y: 400 }, { x: 400, y: 400 });
    expect(onSwipe).toHaveBeenCalledWith(1);
  });

  it("pages backward on a rightward swipe past the threshold", () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipePage(onSwipe));
    swipe(result.current, { x: 400, y: 400 }, { x: 500, y: 400 });
    expect(onSwipe).toHaveBeenCalledWith(-1);
  });

  it("ignores a tap — small movement never pages", () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipePage(onSwipe));
    swipe(result.current, { x: 400, y: 400 }, { x: 410, y: 405 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores a mostly-vertical drag even if it's long", () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipePage(onSwipe));
    swipe(result.current, { x: 400, y: 200 }, { x: 430, y: 400 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("drops the gesture on pointercancel without paging", () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipePage(onSwipe));
    act(() => {
      result.current.onPointerDown({ clientX: 500, clientY: 400 });
      result.current.onPointerCancel();
      result.current.onPointerUp({ clientX: 300, clientY: 400 });
    });
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
