import { useState, useMemo, useCallback } from "react";

/*
  Avatar filtering — carved out of family-board.jsx:540-563.

  `hidden` is session state and starts as null, which means "use the default
  set from settings" (each member's `onBoard` flag). The first tap on a face
  materializes the list, and the Reset chip puts it back to null. That
  three-state dance is the reason `filterTouched` compares joined strings
  rather than checking `hidden !== null` alone: tapping a face off and back on
  leaves a non-null `hidden` that still matches the default, and the chip
  should disappear again.

  Moved as-is, including the memo dependency lists.
*/
export function useMemberFilter(members, events) {
  /* Session filter. null means "use the default set from settings". */
  const [hidden, setHidden] = useState(null);

  const defaultHidden = useMemo(
    () => members.filter((m) => m.onBoard === false).map((m) => m.id),
    [members],
  );
  const hiddenIds = hidden ?? defaultHidden;
  const isShown = useCallback((id) => !hiddenIds.includes(id), [hiddenIds]);
  const shownMembers = useMemo(() => members.filter((m) => isShown(m.id)), [members, isShown]);
  const filtered = useMemo(
    () => events.filter((e) => (e.memberIds || []).some(isShown)),
    [events, isShown],
  );
  const filterTouched = hidden !== null && hidden.join() !== defaultHidden.join();

  const toggleMember = (id) => {
    const next = hiddenIds.includes(id) ? hiddenIds.filter((x) => x !== id) : [...hiddenIds, id];
    setHidden(next);
  };

  const resetFilter = () => setHidden(null);

  return { isShown, shownMembers, filtered, filterTouched, toggleMember, resetFilter };
}
