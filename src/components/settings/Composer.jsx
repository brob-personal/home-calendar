import { Sheet } from "../shell/Sheet.jsx";
import { EventForm } from "./EventForm.jsx";

/*
  New-event composer — now a thin wrapper around EventForm (the fields/state/
  multi-day logic all live there, shared with EventDetailSheet). This file
  only owns: the initial draft's defaults, the sheet chrome, and the
  Cancel/Add footer.
*/
export function Composer({ members, date, settings, onSave, onClose }) {
  const start = new Date(date);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60000);

  const initial = {
    title: "",
    memberIds: [members[0]?.id].filter(Boolean),
    variant: 0,
    start,
    end,
    allDay: false,
    milestone: false,
    location: "",
    description: "",
  };

  return (
    <Sheet title="New event" onClose={onClose}>
      <EventForm
        initial={initial}
        members={members}
        settings={settings}
        placeholderTitle="New event"
        renderFooter={(draft, canSave) => (
          <div className="fb-sheetfoot">
            <button className="fb-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="fb-primary" disabled={!canSave} onClick={() => canSave && onSave(draft)}>
              Add event
            </button>
          </div>
        )}
      />
    </Sheet>
  );
}
