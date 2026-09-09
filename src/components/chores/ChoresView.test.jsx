import { useCallback, useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { addDays, startOfWeek } from "../../lib/date.js";
import { BoardContext } from "../../state/BoardContext.js";
import { ModeContext } from "../../state/ModeContext.js";
import { normalizeTask, normalizeRoutine } from "../../contracts/schema.js";
import { ChoresView } from "./ChoresView.jsx";

/*
  ============================================================================
  PLAN.md §R11 acceptance: "Chores assign by both drag and tap. Completion
  moves them to the bottom. A weekly rotation advances correctly across a
  simulated month, verified by R13's tests [...] Everything survives
  reload."

  Reload survival and the rotation math itself are covered elsewhere —
  persistence.integration.test.jsx's pattern for the former (useBoardData
  owns the actual store round-trip, tested generically there) and
  rotation.test.js's simulated-month walk for the latter. This file is the
  seam test for the one thing only the rendered component can prove: that
  BoardContext's mutators and ModeContext's roster actually drive tap
  assignment, drag assignment and the completed-sinks-to-the-bottom render
  rule, the way mode.integration.test.jsx is the seam test for ModeContext
  rather than trusting useModeState.test.js alone.

  ChoresView reads BoardContext/ModeContext directly rather than taking
  props, so this harness supplies both with a minimal in-memory
  implementation of the same mutator shape useBoardData.js exposes —
  intentionally reimplemented rather than importing the real hook, so a bug
  in useBoardData's persistence path can't mask a bug here or vice versa.
  ============================================================================
*/

const MEMBERS = [
  { id: "brian", name: "Brian", color: "#7EB6E8", photo: "", onBoard: true, modes: ["roommate"] },
  { id: "rachel", name: "Rachel", color: "#F0A3B8", photo: "", onBoard: true, modes: ["roommate"] },
];

function Harness({ initialTasks = [], initialRoutines = [] }) {
  const [tasks, setTasks] = useState(() => initialTasks.map(normalizeTask));
  const [routines, setRoutines] = useState(() => initialRoutines.map(normalizeRoutine));

  const addTask = (draft) =>
    setTasks((prev) => {
      const order = prev.reduce((m, t) => Math.max(m, t.order), -1) + 1;
      return [...prev, normalizeTask({ id: `new-${prev.length}-${draft.title}`, order, ...draft })];
    });
  const updateTask = (id, patch) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? normalizeTask({ ...t, ...patch }) : t)));
  const toggleTask = (id) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : new Date() } : t,
      ),
    );
  const ensureRoutineTask = useCallback((draft) => {
    setTasks((prev) =>
      prev.some((t) => t.id === draft.id) ? prev : [...prev, normalizeTask(draft)],
    );
  }, []);
  const addRoutine = (draft) =>
    setRoutines((prev) => [...prev, normalizeRoutine({ id: `newr-${prev.length}`, ...draft })]);
  const removeRoutine = (id) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    setTasks((prev) => prev.filter((t) => t.routineId !== id));
  };

  const board = {
    members: MEMBERS,
    tasks,
    routines,
    addTask,
    updateTask,
    toggleTask,
    ensureRoutineTask,
    addRoutine,
    removeRoutine,
  };
  const mode = {
    mode: "roommate",
    setMode: vi.fn(),
    roster: MEMBERS,
    calendars: [],
    views: ["day", "week", "month", "agenda", "todo"],
    isRoommate: true,
  };

  return (
    <BoardContext.Provider value={board}>
      <ModeContext.Provider value={mode}>
        <ChoresView />
      </ModeContext.Provider>
    </BoardContext.Provider>
  );
}

function fakeDataTransfer() {
  const store = {};
  return {
    setData: (type, value) => {
      store[type] = value;
    },
    getData: (type) => store[type] || "",
    effectAllowed: null,
  };
}

describe("ChoresView — bank and seeding", () => {
  it("renders unassigned chores in the bank", () => {
    render(<Harness initialTasks={[{ id: "t1", title: "Dishes", emoji: "🍽️" }]} />);
    const bank = screen.getByText("Bank").closest(".fb-chorebank");
    expect(within(bank).getByText("Dishes")).toBeInTheDocument();
  });

  it("shows an empty state once every chore is assigned", () => {
    render(<Harness initialTasks={[{ id: "t1", title: "Dishes", assigneeId: "brian" }]} />);
    const bank = screen.getByText("Bank").closest(".fb-chorebank");
    expect(within(bank).getByText("All chores assigned.")).toBeInTheDocument();
  });
});

describe("ChoresView — tap to assign", () => {
  it("selecting a bank chore then tapping a person's header assigns it", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness initialTasks={[{ id: "t1", title: "Dishes" }]} />);

    await user.click(screen.getByText("Dishes"));
    await user.click(screen.getByRole("button", { name: /Rachel/ }));

    const rachelCol = screen.getByRole("button", { name: /Rachel/ }).closest(".fb-chorecol");
    expect(within(rachelCol).getByText("Dishes")).toBeInTheDocument();
    const bank = screen.getByText("Bank").closest(".fb-chorebank");
    expect(within(bank).queryByText("Dishes")).not.toBeInTheDocument();
  });

  it("tapping the same card again cancels the selection", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness initialTasks={[{ id: "t1", title: "Dishes" }]} />);

    await user.click(screen.getByText("Dishes"));
    await user.click(screen.getByText("Dishes"));
    await user.click(screen.getByRole("button", { name: /Rachel/ }));

    const bank = screen.getByText("Bank").closest(".fb-chorebank");
    expect(within(bank).getByText("Dishes")).toBeInTheDocument();
  });

  it("tapping the Bank header sends an assigned chore back to the bank", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness initialTasks={[{ id: "t1", title: "Dishes", assigneeId: "brian" }]} />);

    await user.click(screen.getByText("Dishes"));
    await user.click(screen.getByText("Bank"));

    const bank = screen.getByText("Bank").closest(".fb-chorebank");
    expect(within(bank).getByText("Dishes")).toBeInTheDocument();
  });
});

describe("ChoresView — drag to assign", () => {
  it("dragging a bank chore onto a person's column assigns it", () => {
    render(<Harness initialTasks={[{ id: "t1", title: "Dishes" }]} />);

    const card = screen.getByText("Dishes").closest(".fb-chorecard");
    const rachelCol = screen.getByRole("button", { name: /Rachel/ }).closest(".fb-chorecol");
    const dt = fakeDataTransfer();

    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.drop(rachelCol, { dataTransfer: dt });

    expect(within(rachelCol).getByText("Dishes")).toBeInTheDocument();
  });
});

describe("ChoresView — completion", () => {
  it("checking a chore sinks it below the still-open ones in the same column", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Harness
        initialTasks={[
          { id: "t1", title: "Dishes", assigneeId: "brian", order: 0 },
          { id: "t2", title: "Vacuum", assigneeId: "brian", order: 1 },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: 'Mark "Dishes" done' }));

    const brianCol = screen.getByRole("button", { name: /Brian/ }).closest(".fb-chorecol");
    const titles = within(brianCol)
      .getAllByText(/Dishes|Vacuum/)
      .map((el) => el.textContent);
    expect(titles).toEqual(["Vacuum", "Dishes"]);
  });

  it("tapping the checkbox does not also select the card for reassignment", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness initialTasks={[{ id: "t1", title: "Dishes", assigneeId: "brian" }]} />);

    await user.click(screen.getByRole("button", { name: 'Mark "Dishes" done' }));
    await user.click(screen.getByRole("button", { name: /Rachel/ }));

    /* If the checkbox tap had also selected the card, tapping Rachel's
       header just now would have reassigned it there. */
    const brianCol = screen.getByRole("button", { name: /Brian/ }).closest(".fb-chorecol");
    expect(within(brianCol).getByText("Dishes")).toBeInTheDocument();
  });
});

describe("ChoresView — routines", () => {
  it("materializes this week's instance of an active fixed routine into the assignee's column", () => {
    render(
      <Harness
        initialRoutines={[
          {
            id: "r1",
            title: "Trash",
            emoji: "🗑️",
            kind: "fixed",
            assigneeId: "rachel",
            anchor: startOfWeek(new Date()), // this week's Sunday
          },
        ]}
      />,
    );

    const rachelCol = screen.getByRole("button", { name: /Rachel/ }).closest(".fb-chorecol");
    expect(within(rachelCol).getByText("Trash")).toBeInTheDocument();
  });

  it("does not materialize a routine before its anchor week", () => {
    render(
      <Harness
        initialRoutines={[
          {
            id: "r1",
            title: "Trash",
            kind: "fixed",
            assigneeId: "rachel",
            anchor: addDays(startOfWeek(new Date()), 14), // two weeks from now
          },
        ]}
      />,
    );

    expect(screen.queryByText("Trash")).not.toBeInTheDocument();
  });

  it("adding a rotating routine from the form materializes it for the current cycle's member", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "+ Routine" }));
    await user.type(screen.getByPlaceholderText("What's the chore?"), "Vacuum");
    await user.click(screen.getByRole("button", { name: "Rotates" }));
    await user.click(screen.getByRole("button", { name: "Add routine" }));

    /* Anchored today (Wednesday, this week), so it should show up assigned
       to whichever member the rotation's cycle 0 lands on, immediately. */
    expect(await screen.findByText("Vacuum")).toBeInTheDocument();
  });
});
