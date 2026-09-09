import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Composer } from "./Composer.jsx";

const MEMBERS = [{ id: "brian", name: "Brian", color: "#7EB6E8", onBoard: true }];

const noop = () => {};

function renderComposer(settings) {
  return render(
    <Composer members={MEMBERS} date={new Date(2026, 2, 15)} settings={settings} onSave={noop} onClose={noop} />,
  );
}

/*
  Deferred Defect #4's regression guard: the hour picker used to be hardcoded
  to 6am-10pm regardless of settings.
*/
describe("Composer's hour picker", () => {
  it("offers exactly [dayStart, dayEnd) — the default 7-21 window", () => {
    renderComposer({ dayStart: 7, dayEnd: 21 });
    expect(screen.getByRole("button", { name: "7a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8p" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "6a" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "9p" })).not.toBeInTheDocument();
  });

  it("follows a board configured for a 5am start, which the old hardcoded range could never offer", () => {
    renderComposer({ dayStart: 5, dayEnd: 9 });
    expect(screen.getByRole("button", { name: "5a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8a" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "9a" })).not.toBeInTheDocument();
  });
});
