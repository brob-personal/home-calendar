import { useState } from "react";

/*
  Derives which way `anchor` just moved (1 = forward in time, -1 = back),
  purely by comparing consecutive values, rather than threading a `dir` prop
  down from whichever control changed it. Every path that moves `anchor` —
  HeaderControls' pager arrows, useSwipePage's gesture, ViewSwitcher's
  "Return to Today" — ends up driving Header's day/date roll animation the
  same way for free.

  Uses React's documented "adjust state while rendering" pattern (calling
  setState directly in the render body, guarded by a comparison) instead of
  mutating a ref during render, so behavior stays correct under StrictMode's
  development-mode double-render.
*/
export function useAnchorDirection(anchor) {
  const [prevAnchor, setPrevAnchor] = useState(anchor);
  const [dir, setDir] = useState(1);
  if (anchor.getTime() !== prevAnchor.getTime()) {
    setDir(anchor.getTime() > prevAnchor.getTime() ? 1 : -1);
    setPrevAnchor(anchor);
  }
  return dir;
}
