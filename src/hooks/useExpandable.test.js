import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useExpandable } from "./useExpandable.js";

describe("useExpandable", () => {
  it("mounts immediately when open starts true", () => {
    const { result } = renderHook(() => useExpandable(true, 160));
    expect(result.current.mounted).toBe(true);
    expect(result.current.closing).toBe(false);
  });

  it("stays mounted and marks closing the instant open flips false", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ open }) => useExpandable(open, 160), {
      initialProps: { open: true },
    });

    rerender({ open: false });

    expect(result.current.mounted).toBe(true);
    expect(result.current.closing).toBe(true);
    vi.useRealTimers();
  });

  it("unmounts once the exit duration elapses", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ open }) => useExpandable(open, 160), {
      initialProps: { open: true },
    });

    rerender({ open: false });
    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(result.current.mounted).toBe(false);
    expect(result.current.closing).toBe(false);
    vi.useRealTimers();
  });

  it("cancels a pending close and re-opens cleanly if open flips back true mid-animation", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ open }) => useExpandable(open, 160), {
      initialProps: { open: true },
    });

    rerender({ open: false });
    rerender({ open: true });
    vi.advanceTimersByTime(160);

    expect(result.current.mounted).toBe(true);
    expect(result.current.closing).toBe(false);
    vi.useRealTimers();
  });

  it("never mounts if open starts and stays false", () => {
    const { result } = renderHook(() => useExpandable(false, 160));
    expect(result.current.mounted).toBe(false);
    expect(result.current.closing).toBe(false);
  });
});
