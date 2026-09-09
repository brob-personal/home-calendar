import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { ErrorBoundary } from "./ErrorBoundary.jsx";

function Bomb() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>board content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("board content")).toBeInTheDocument();
  });

  it("falls back to a recovery screen instead of unmounting on a render error", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/needs to restart/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload now" })).toBeInTheDocument();
  });

  it("schedules an automatic reload so an unattended board recovers on its own", () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    vi.useRealTimers();
  });
});
