import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { useAnchorDirection } from "./useAnchorDirection.js";

describe("useAnchorDirection", () => {
  it("defaults to forward before anchor ever changes", () => {
    const { result } = renderHook(() => useAnchorDirection(new Date(2026, 0, 15)));
    expect(result.current).toBe(1);
  });

  it("reports forward when anchor moves to a later date", () => {
    const { result, rerender } = renderHook(({ anchor }) => useAnchorDirection(anchor), {
      initialProps: { anchor: new Date(2026, 0, 15) },
    });
    rerender({ anchor: new Date(2026, 0, 16) });
    expect(result.current).toBe(1);
  });

  it("reports backward when anchor moves to an earlier date", () => {
    const { result, rerender } = renderHook(({ anchor }) => useAnchorDirection(anchor), {
      initialProps: { anchor: new Date(2026, 0, 15) },
    });
    rerender({ anchor: new Date(2026, 0, 14) });
    expect(result.current).toBe(-1);
  });

  it("keeps the last direction across renders where anchor doesn't change", () => {
    const { result, rerender } = renderHook(({ anchor }) => useAnchorDirection(anchor), {
      initialProps: { anchor: new Date(2026, 0, 15) },
    });
    rerender({ anchor: new Date(2026, 0, 14) });
    expect(result.current).toBe(-1);
    rerender({ anchor: new Date(2026, 0, 14) });
    expect(result.current).toBe(-1);
  });
});
