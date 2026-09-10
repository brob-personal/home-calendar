import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

import { Roller } from "./Roller.jsx";

const DAYS = ["Sun", "Mon", "Tue"];

describe("Roller", () => {
  it("shows the current value with no animation on first mount", () => {
    const { container } = render(<Roller value="Mon" allValues={DAYS} dir={1} className="fb-dow" />);
    const val = container.querySelector(".fb-roller-val");
    expect(val).toHaveTextContent("Mon");
    expect(val.className).toBe("fb-roller-val");
  });

  it("reserves width by stacking every possible value, hidden, alongside the visible one", () => {
    const { container } = render(<Roller value="Mon" allValues={DAYS} dir={1} className="fb-dow" />);
    const sizers = container.querySelectorAll(".fb-roller-size");
    expect(Array.from(sizers).map((s) => s.textContent)).toEqual(DAYS);
  });

  it("rolls the new value in from below and the old one out upward when dir is forward", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Roller value="Mon" allValues={DAYS} dir={1} className="fb-dow" />);
    rerender(<Roller value="Tue" allValues={DAYS} dir={1} className="fb-dow" />);

    const vals = container.querySelectorAll(".fb-roller-val");
    expect(vals).toHaveLength(2);
    expect([...vals].find((v) => v.textContent === "Mon")).toHaveClass("fb-roller-out-up");
    expect([...vals].find((v) => v.textContent === "Tue")).toHaveClass("fb-roller-in-up");

    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(container.querySelectorAll(".fb-roller-val")).toHaveLength(1);
    expect(container.querySelector(".fb-roller-val")).toHaveTextContent("Tue");
    vi.useRealTimers();
  });

  it("rolls in/out downward when dir is backward", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Roller value="Tue" allValues={DAYS} dir={-1} className="fb-dow" />);
    rerender(<Roller value="Mon" allValues={DAYS} dir={-1} className="fb-dow" />);

    const vals = container.querySelectorAll(".fb-roller-val");
    expect([...vals].find((v) => v.textContent === "Tue")).toHaveClass("fb-roller-out-down");
    expect([...vals].find((v) => v.textContent === "Mon")).toHaveClass("fb-roller-in-down");
    vi.useRealTimers();
  });

  it("doesn't replay the animation or duplicate entries on a re-render with the same value", () => {
    const { container, rerender } = render(<Roller value="Mon" allValues={DAYS} dir={1} className="fb-dow" />);
    rerender(<Roller value="Mon" allValues={DAYS} dir={1} className="fb-dow" />);
    const vals = container.querySelectorAll(".fb-roller-val");
    expect(vals).toHaveLength(1);
    expect(vals[0].className).toBe("fb-roller-val");
  });
});
