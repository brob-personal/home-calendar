import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PersonProgress } from "./PersonProgress.jsx";

const MEMBER = { id: "a", name: "Ann", color: "#f00" };
const NOW = new Date(2026, 0, 15, 12, 0);

function ev(id, startH, endH, memberIds = ["a"], allDay = false) {
  return {
    id,
    start: new Date(2026, 0, 15, startH),
    end: new Date(2026, 0, 15, endH),
    allDay,
    memberIds,
  };
}

describe("PersonProgress", () => {
  it("renders nothing for a member with no timed events today", () => {
    const { container } = render(<PersonProgress member={MEMBER} events={[]} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts events whose end has already passed as done", () => {
    render(
      <PersonProgress
        member={MEMBER}
        events={[ev("morning", 8, 10), ev("afternoon", 14, 16)]}
        now={NOW}
      />,
    );
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("ignores all-day events and events belonging to someone else", () => {
    render(
      <PersonProgress
        member={MEMBER}
        events={[ev("holiday", 0, 23, ["a"], true), ev("bens", 8, 10, ["b"])]}
        now={NOW}
      />,
    );
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });

  it("ignores events on a different day", () => {
    const yesterday = {
      id: "y",
      start: new Date(2026, 0, 14, 8),
      end: new Date(2026, 0, 14, 9),
      allDay: false,
      memberIds: ["a"],
    };
    render(<PersonProgress member={MEMBER} events={[yesterday]} now={NOW} />);
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });
});
