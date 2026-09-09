import { createContext, useContext, useMemo, useCallback } from "react";

import { THEMES } from "../lib/theme.js";
import { splitFill, variantColor } from "../lib/color.js";

/*
  PLAN.md §R2 item 5: "Introduce PaletteContext so fillFor / firstColor stop
  being prop-drilled into four views."

  Those two functions were computed in the root and threaded down as `fill`
  and `color` props to WeekView, MonthView, AgendaView and Countdowns. They
  are now read from context instead. DayView never received them — it derives
  its block colour per lane from the lane owner's hue directly — so only three
  views and the countdown ticker consume this.

  The colour rule these functions encode, and which nothing downstream may
  break: a person is a hue. An event's `variant` (Google's colorId, 1-11,
  minus one) picks a shade *within* that hue rather than a colour of its own,
  and a shared event gets a hard diagonal band per visible owner. Filtering a
  person out drops their band, so hiding people also simplifies the split.

  Two structural notes:

    - This module exports no components, which is deliberate. A file that
      exports both a component and hooks trips
      `react-refresh/only-export-components`, and App.jsx renders
      `<PaletteContext.Provider>` directly rather than through a wrapper — one
      less indirection for the same result. Hence .js, not .jsx.
    - The provider takes its value as a prop rather than reaching for state
      itself, so R3 — which owns src/state/ per §2 and adds BoardContext
      beside this file — can wrap it without touching the colour logic.
*/

export const PaletteContext = createContext(null);

export function usePalette() {
  const value = useContext(PaletteContext);
  if (!value) {
    throw new Error("usePalette must be used inside a PaletteContext provider.");
  }
  return value;
}

/*
  The palette bundle, computed exactly as the root computed it
  (family-board.jsx:585-618). It lives here rather than in src/hooks/ so that
  the producer and the consumer of this context stay in one file, and it is
  exported separately from the context because App.jsx needs the same values
  for its CSS custom properties — a component cannot consume a context it is
  itself providing.
*/
export function useBoardPalette(members, settings, isShown) {
  const theme = THEMES[settings.theme] || THEMES.paper;
  const paper = settings.customPaper || theme.paper;

  /*
    The prototype wrote `settings.customPaper ? { ...theme, paper: customPaper }
    : theme`, which returns the theme object itself in the common case. Spreading
    unconditionally yields the same five values — nothing compares the palette by
    identity — and gives the memo below a stable dependency.
  */
  const palette = useMemo(() => ({ ...theme, paper }), [theme, paper]);

  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  /* Only the visible owners contribute bands, so filtering also simplifies
     the split on a shared event. */
  const fillFor = useCallback(
    (e) =>
      splitFill(
        (e.memberIds || [])
          .filter(isShown)
          .map((id) => (byId[id] ? variantColor(byId[id].color, e.variant) : null)),
        palette.surface,
      ),
    [byId, palette.surface, isShown],
  );

  const firstColor = useCallback(
    (e) => {
      const id = (e.memberIds || []).find(isShown);
      return id && byId[id] ? variantColor(byId[id].color, e.variant) : palette.mute;
    },
    [byId, palette.mute, isShown],
  );

  return useMemo(
    () => ({ palette, byId, fillFor, firstColor }),
    [palette, byId, fillFor, firstColor],
  );
}
