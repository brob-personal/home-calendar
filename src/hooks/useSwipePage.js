import { useRef } from "react";

/*
  PLAN.md §R12 item 2: paging used to be chevron-only. This adds
  pointer-event swipe paging — spread the returned handlers onto whatever
  container should catch the gesture (App.jsx puts them on `.fb-stage`,
  gated to day/week per the spec).

  Pointer, not touch: this is the same event family Fit/NoteWindow already
  standardize on for iOS Safari, and it works for a mouse in dev too.
  Distances are read straight off clientX/Y in viewport pixels — a swipe is a
  binary gesture (past the threshold or not), so <Fit>'s scale factor, which
  NoteWindow's drag math has to divide out for exact 1:1 tracking, doesn't
  need correcting here.

  A tap (small dx/dy) always falls under MIN_DIST and never calls onSwipe, so
  this coexists with the views' own onClick-to-select without stealing taps.
*/
const MIN_DIST = 60;
const MAX_OFF_AXIS = 60;

export function useSwipePage(onSwipe) {
  const start = useRef(null);

  const onPointerDown = (e) => {
    start.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < MIN_DIST || Math.abs(dy) > MAX_OFF_AXIS) return;
    onSwipe(dx < 0 ? 1 : -1);
  };

  const onPointerCancel = () => {
    start.current = null;
  };

  return { onPointerDown, onPointerUp, onPointerCancel };
}
