import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "./lib/store.js";
import { STORE_KEYS } from "./contracts/schema.js";
import App from "./App.jsx";

/*
  ============================================================================
  PLAN.md §R10 acceptance, end to end:

    "Toggling swaps calendars, roster and colours wholesale. The choice
    survives reload. The To-do tab appears in Roommate mode and is absent in
    Personal mode."

  useModeState.test.js covers the derivation in isolation; this is the seam
  test — the actual Settings UI switching the actual board, the way
  persistence.integration.test.jsx is the seam test for the Date landmine
  rather than trusting the unit tests on either side of it.

  The header redesign moved both the view list and the member legend behind
  popovers (ViewSwitcher, MemberPicker), so "is To-do present" and "is Brian
  present" now mean "open the relevant dropdown, then look for the option" —
  the assertions are the same as before the redesign, just one click deeper.
  ============================================================================
*/

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

const openViews = (user) => user.click(screen.getByRole("button", { name: "Day" }));
const openMembers = (user) =>
  user.click(screen.getByRole("button", { name: /Choose whose calendars/ }));

describe("Roommate mode vs Personal mode", () => {
  it("has no To-do tab in Personal mode, the default", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "Day" });

    await openViews(user);
    expect(screen.queryByRole("option", { name: "To-do" })).not.toBeInTheDocument();
  });

  it("switching to Roommate mode in Settings adds the To-do tab", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "Day" });

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    await user.click(screen.getByRole("button", { name: "Roommate" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    await openViews(user);
    expect(await screen.findByRole("option", { name: "To-do" })).toBeInTheDocument();
  });

  it("swaps the roster wholesale — the family's avatars leave the member picker", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "Day" });

    /* The family arrives in Personal mode by default (contracts/defaults.js). */
    await openMembers(user);
    expect(screen.getByRole("option", { name: /Brian/ })).toBeInTheDocument();
    await openMembers(user); // close

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    await user.click(screen.getByRole("button", { name: "Roommate" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    /* Roommate mode starts with an empty roster — the roommates are not the
       family (SCOPING.txt) — so nobody from Personal mode carries over. */
    await openMembers(user);
    expect(screen.queryByRole("option", { name: /Brian/ })).not.toBeInTheDocument();
  });

  it("a person checked into Roommate mode in Settings appears in Roommate's member picker", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "Day" });

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    const brianRow = screen.getByDisplayValue("Brian").closest(".fb-memberblock");
    await user.click(within(brianRow).getByRole("checkbox", { name: "Roommate" }));
    await user.click(screen.getByRole("button", { name: "Roommate" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    await openMembers(user);
    expect(screen.getByRole("option", { name: /Brian/ })).toBeInTheDocument();
  });

  it("the mode survives a reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await screen.findByRole("button", { name: "Day" });

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    await user.click(screen.getByRole("button", { name: "Roommate" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await openViews(user);
    await screen.findByRole("option", { name: "To-do" });

    await waitFor(async () => {
      const settings = await store.get(STORE_KEYS.settings);
      expect(settings?.mode).toBe("roommate");
    });

    first.unmount();
    render(<App />);
    await screen.findByRole("button", { name: "Day" });

    await openViews(user);
    expect(await screen.findByRole("option", { name: "To-do" })).toBeInTheDocument();
  });
});
