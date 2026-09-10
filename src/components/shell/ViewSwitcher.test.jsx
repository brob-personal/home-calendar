import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ViewSwitcher } from "./ViewSwitcher.jsx";

/*
  Replaces Footer.test.jsx's "view switcher" coverage: same contract (renders
  exactly the given views, spells "todo" as "To-do", calls setView with the
  raw id) now expressed as one active pill plus a popover for the rest.
*/
const noop = () => {};

describe("ViewSwitcher", () => {
  it("shows the active view as the closed button's label", () => {
    render(<ViewSwitcher view="day" setView={noop} views={["day", "week", "month", "agenda"]} />);
    expect(screen.getByRole("button", { name: /Day/ })).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("opens to list every other view, personal mode's remaining three", () => {
    render(<ViewSwitcher view="day" setView={noop} views={["day", "week", "month", "agenda"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Day/ }));
    for (const label of ["Week", "Month", "Agenda"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("option", { name: "Day" })).not.toBeInTheDocument();
  });

  it("spells the To-do tab the way SCOPING.txt does", () => {
    render(<ViewSwitcher view="day" setView={noop} views={["day", "todo"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Day/ }));
    expect(screen.getByRole("option", { name: "To-do" })).toBeInTheDocument();
  });

  it("calls setView with the raw view id and closes the popover", () => {
    const setView = vi.fn();
    render(<ViewSwitcher view="day" setView={setView} views={["day", "todo"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Day/ }));
    fireEvent.click(screen.getByRole("option", { name: "To-do" }));
    expect(setView).toHaveBeenCalledWith("todo");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
