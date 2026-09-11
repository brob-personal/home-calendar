import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateField } from "./DateField.jsx";

describe("DateField", () => {
  it("shows the full formatted date and no popover until clicked", () => {
    render(<DateField value={new Date(2026, 8, 9)} onChange={() => {}} ariaLabel="Event date" />);
    expect(screen.getByRole("button", { name: "Event date" })).toHaveTextContent(
      "Wednesday, September 9",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a month grid on click, showing the value's month", async () => {
    const user = userEvent.setup();
    render(<DateField value={new Date(2026, 8, 9)} onChange={() => {}} ariaLabel="Event date" />);
    await user.click(screen.getByRole("button", { name: "Event date" }));
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9" })).toHaveClass("is-on");
  });

  it("picking a day calls onChange with that date and closes the popover", async () => {
    const user = userEvent.setup();
    let picked = null;
    render(
      <DateField
        value={new Date(2026, 8, 9)}
        onChange={(d) => (picked = d)}
        ariaLabel="Event date"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(screen.getByRole("button", { name: "15" }));
    expect(picked).toEqual(new Date(2026, 8, 15));
    expect(screen.queryByText("September 2026")).not.toBeInTheDocument();
  });

  it("disables days before minDate", async () => {
    const user = userEvent.setup();
    render(
      <DateField
        value={new Date(2026, 8, 9)}
        onChange={() => {}}
        minDate={new Date(2026, 8, 9)}
        ariaLabel="End date"
      />,
    );
    await user.click(screen.getByRole("button", { name: "End date" }));
    expect(screen.getByRole("button", { name: "5" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "9" })).not.toBeDisabled();
  });

  it("pages to the next/previous month without changing the selected value", async () => {
    const user = userEvent.setup();
    render(<DateField value={new Date(2026, 8, 9)} onChange={() => {}} ariaLabel="Event date" />);
    await user.click(screen.getByRole("button", { name: "Event date" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("October 2026")).toBeInTheDocument();
  });
});
