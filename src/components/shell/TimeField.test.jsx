import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimeField } from "./TimeField.jsx";

describe("TimeField", () => {
  it("shows the formatted time and no list until clicked", () => {
    render(<TimeField minutes={8 * 60} onChange={() => {}} timeFormat="12" ariaLabel="Start time" />);
    expect(screen.getByRole("button", { name: "Start time" })).toHaveTextContent("8a");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a 96-row 15-minute list on click", async () => {
    const user = userEvent.setup();
    render(<TimeField minutes={8 * 60} onChange={() => {}} timeFormat="12" ariaLabel="Start time" />);
    await user.click(screen.getByRole("button", { name: "Start time" }));
    expect(screen.getAllByRole("option")).toHaveLength(96);
    expect(screen.getByRole("option", { name: "8a" })).toHaveClass("is-on");
  });

  it("picking an option calls onChange with its minutes and closes the list", async () => {
    const user = userEvent.setup();
    let picked = null;
    render(
      <TimeField minutes={8 * 60} onChange={(m) => (picked = m)} timeFormat="12" ariaLabel="Start time" />,
    );
    await user.click(screen.getByRole("button", { name: "Start time" }));
    await user.click(screen.getByRole("option", { name: "9a" }));
    expect(picked).toBe(9 * 60);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders in 24-hour when asked", async () => {
    const user = userEvent.setup();
    render(<TimeField minutes={8 * 60} onChange={() => {}} timeFormat="24" ariaLabel="Start time" />);
    expect(screen.getByRole("button", { name: "Start time" })).toHaveTextContent("8:00");
    await user.click(screen.getByRole("button", { name: "Start time" }));
    expect(screen.getByRole("option", { name: "20:00" })).toBeInTheDocument();
  });

  it("annotates each option with its duration from durationFrom, wrapping past midnight", async () => {
    const user = userEvent.setup();
    render(
      <TimeField
        minutes={9 * 60}
        onChange={() => {}}
        timeFormat="12"
        durationFrom={8 * 60}
        ariaLabel="End time"
      />,
    );
    await user.click(screen.getByRole("button", { name: "End time" }));
    expect(screen.getByRole("option", { name: "9a (1 hr)" })).toBeInTheDocument();
    // 7am is before the 8am start, so it wraps to a 23-hour span.
    expect(screen.getByRole("option", { name: "7a (23 hrs)" })).toBeInTheDocument();
  });

  it("double-click swaps to a free-text input; a valid entry commits on blur", async () => {
    const user = userEvent.setup();
    let picked = null;
    render(
      <TimeField minutes={8 * 60} onChange={(m) => (picked = m)} timeFormat="12" ariaLabel="Start time" />,
    );
    await user.dblClick(screen.getByRole("button", { name: "Start time" }));
    const input = screen.getByRole("textbox", { name: "Start time" });
    await user.clear(input);
    await user.type(input, "9:15am");
    await user.tab();
    expect(picked).toBe(9 * 60 + 15);
  });

  it("an unparseable typed value reverts without calling onChange", async () => {
    const user = userEvent.setup();
    let called = false;
    render(
      <TimeField minutes={8 * 60} onChange={() => (called = true)} timeFormat="12" ariaLabel="Start time" />,
    );
    await user.dblClick(screen.getByRole("button", { name: "Start time" }));
    const input = screen.getByRole("textbox", { name: "Start time" });
    await user.clear(input);
    await user.type(input, "not a time");
    await user.tab();
    expect(called).toBe(false);
    expect(screen.getByRole("button", { name: "Start time" })).toHaveTextContent("8a");
  });
});
