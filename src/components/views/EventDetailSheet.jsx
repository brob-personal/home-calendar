import { useState } from "react";

import { Sheet } from "../shell/Sheet.jsx";
import { EventForm } from "../settings/EventForm.jsx";

/*
  Edit/delete sheet — now a thin wrapper around the same EventForm Composer
  uses, so an edited event goes through identical field logic to a freshly
  authored one. Only this file's own concerns remain: the sheet chrome and
  the two-step delete confirm.
*/
export function EventDetailSheet({ event, members, settings, onSave, onDelete, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Sheet title="Event" onClose={onClose}>
      <EventForm
        initial={event}
        members={members}
        settings={settings}
        placeholderTitle="Event"
        renderFooter={(draft, canSave) => (
          <div className="fb-sheetfoot">
            {confirmDelete ? (
              <>
                <span className="fb-inlabel fb-deleteprompt">Delete this event?</span>
                <button className="fb-ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
                <button className="fb-primary fb-danger" onClick={onDelete}>
                  Yes, delete
                </button>
              </>
            ) : (
              <>
                <button className="fb-ghost fb-textdanger" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
                <button className="fb-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button className="fb-primary" disabled={!canSave} onClick={() => canSave && onSave(draft)}>
                  Save
                </button>
              </>
            )}
          </div>
        )}
      />
    </Sheet>
  );
}
