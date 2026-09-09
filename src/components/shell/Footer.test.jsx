import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { Footer } from "./Footer.jsx";

/*
  PLAN.md §R10 item 5: the view switcher used to hardcode
  ["day","week","month","agenda"]; it is now whatever `views` App.jsx hands
  it. This is the receiving end of that change — Footer itself no longer
  knows which mode is active, so the test proves the switcher is a pure
  function of the prop, not of any mode logic living in this component.
*/

const noop = () => {};

function renderFooter(views) {
  return render(
    <Footer
      view="day"
      setView={noop}
      views={views}
      anchor={new Date(2026, 0, 1)}
      setAnchor={noop}
      members={[]}
      isShown={() => true}
      onToggleMember={noop}
      showReset={false}
      onReset={noop}
      onCompose={noop}
    />,
  );
}

describe("Footer's view switcher", () => {
  it("renders exactly the views it is given, personal mode's four", () => {
    renderFooter(["day", "week", "month", "agenda"]);
    for (const label of ["Day", "Week", "Month", "Agenda"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "To-do" })).not.toBeInTheDocument();
  });

  it("renders the To-do tab when the mode adds it, spelled the way SCOPING.txt does", () => {
    renderFooter(["day", "week", "month", "agenda", "todo"]);
    expect(screen.getByRole("button", { name: "To-do" })).toBeInTheDocument();
  });

  it("calls setView with the raw view id, not the display label", async () => {
    const setView = vi.fn();
    render(
      <Footer
        view="day"
        setView={setView}
        views={["day", "todo"]}
        anchor={new Date(2026, 0, 1)}
        setAnchor={noop}
        members={[]}
        isShown={() => true}
        onToggleMember={noop}
        showReset={false}
        onReset={noop}
        onCompose={noop}
      />,
    );
    screen.getByRole("button", { name: "To-do" }).click();
    expect(setView).toHaveBeenCalledWith("todo");
  });
});
