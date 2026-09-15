import { useEffect, useState } from "react";

import { CANVAS_W, CANVAS_H, DEVICE_W, DEVICE_H } from "../../lib/canvas.js";

/*
  An opt-in readout of every number <Fit> could possibly be scaling against,
  plus a way to tell which layer a stray edge belongs to.

  Why this exists. The grey band along the bottom of the board on the wall
  iPad has now survived six fixes, and every one of them was a different guess
  at the same unknown: how tall the glass actually is in CSS px. 2160x1620 at
  2x says 810, the device has been handed 810, and the band is still there —
  so one of the assumptions underneath that arithmetic is wrong, and no
  seventh guess is worth more than one measurement.

  Two things are readable here, and the second one is the more important:

  1. The numbers. Every height and width the platform will report, side by
     side, including the rect of .fb-device itself — the actual painted box.
     If that box measures 810 tall and its bottom edge is at 810 while grey is
     still visible below it, then the glass is not 810 CSS px, and the numbers
     above it say what it is instead.

  2. Which layer the band belongs to, by colour. Only two rules in the whole
     stylesheet paint --frame-bg, and they are indistinguishable on screen
     because they are the same #D9DBE0. Under ?diag they are not:

       - magenta  -> `body`, showing below a .fb-fit that is short of the
                     screen. The frame is the problem.
       - lime     -> .fb-fit, showing below a canvas that is short of the
                     frame. The scale is the problem.
       - still grey -> neither. Nothing in the page is painting it, which
                     means it is not the page — iPadOS is drawing over the
                     bottom of the web view, and no amount of sizing inside
                     the page will move it.

     That third outcome is the one six passes could not have found by
     reasoning, and it is entirely consistent with the evidence so far: a band
     that survives the frame being exact, the frame being padded, and the
     canvas being pinned.

  The `?diag` overlay below is for a browser. It was a mistake as the only
  entry point: the board runs as a home-screen app with no address bar, so a
  URL flag is literally untypeable on the wall. viewportRows and tintLayers
  are exported for Settings, which is reachable there — see the Display field
  in ../settings/Settings.jsx.
*/
const DIAG_PARAM = "diag";

export function diagRequested() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has(DIAG_PARAM);
  } catch {
    // A malformed search string is not worth throwing over.
    return false;
  }
}

const box = (el) => {
  const r = el?.getBoundingClientRect();
  if (!r) return "—";
  const n = (v) => Math.round(v);
  return `${n(r.width)}x${n(r.height)} @y${n(r.top)}..${n(r.bottom)}`;
};

/*
  The safe-area insets, which are the one quantity describing the difference
  between the viewport and the glass and the one thing none of Fit.jsx's JS
  signals can see. Read through a throwaway element because there is no JS API
  for env() — the computed padding is the resolved inset.
*/
function safeAreaInsets() {
  if (typeof document === "undefined") return "—";
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:-9999px;top:0;" +
    "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px)" +
    " env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = `t${cs.paddingTop} r${cs.paddingRight} b${cs.paddingBottom} l${cs.paddingLeft}`;
  probe.remove();
  return out.replace(/px/g, "");
}

export function viewportRows() {
  if (typeof window === "undefined") return [];
  const doc = document.documentElement;
  const vv = window.visualViewport;
  const fit = document.querySelector(".fb-fit");
  const device = document.querySelector(".fb-device");
  return [
    ["screen", `${window.screen?.width}x${window.screen?.height}  dpr ${window.devicePixelRatio}`],
    ["window.inner", `${window.innerWidth}x${window.innerHeight}`],
    ["doc.client", `${doc?.clientWidth}x${doc?.clientHeight}`],
    [
      "visualViewport",
      vv
        ? `${Math.round(vv.width)}x${Math.round(vv.height)} off ${Math.round(vv.offsetTop)}`
        : "—",
    ],
    [".fb-fit", box(fit)],
    [".fb-device", box(device)],
    ["canvas const", `${CANVAS_W}x${CANVAS_H}`],
    ["device const", `${DEVICE_W}x${DEVICE_H}`],
    [
      "standalone",
      `${window.navigator?.standalone} / ` +
        `${window.matchMedia?.("(display-mode: standalone)")?.matches}`,
    ],
    ["orientation", `${window.orientation ?? "—"}`],
    ["safe-area", safeAreaInsets()],
  ];
}

/*
  The decisive test, made reachable. Only two rules paint --frame-bg and they
  are the same #D9DBE0, so a stray edge cannot be attributed to either by
  looking at it. Tinted, it can:

    magenta    -> body, below a .fb-fit short of the screen. The frame.
    lime       -> .fb-fit, below a canvas short of the frame. The scale.
    unchanged  -> neither, so it is not the page at all.

  Applied straight to the nodes and left on until the next reload rather than
  held in React state: the Settings sheet covers the board, so the tint has to
  outlive closing it to be worth anything, and a wall board that reloads back
  to normal is the right way for this to end.
*/
export function tintLayers() {
  if (typeof document === "undefined") return;
  document.body.style.background = "magenta";
  const fit = document.querySelector(".fb-fit");
  if (fit) fit.style.background = "lime";
}

export function FitDiag() {
  const [rows, setRows] = useState(viewportRows);

  useEffect(() => {
    // The layer colours. Set on the live nodes rather than in the stylesheet
    // so the sheet the board ships with is untouched by this file existing.
    const fit = document.querySelector(".fb-fit");
    const prevBody = document.body.style.background;
    const prevFit = fit?.style.background;
    tintLayers();

    // Re-read after layout has settled, then on anything that could move the
    // viewport. rAF rather than an immediate read because .fb-device's rect is
    // the point of this and it is not painted yet on the first commit.
    const read = () => setRows(viewportRows());
    const raf = requestAnimationFrame(read);
    const t = setTimeout(read, 600);
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
      document.body.style.background = prevBody;
      if (fit) fit.style.background = prevFit ?? "";
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        padding: "10px 12px",
        background: "rgba(0,0,0,.82)",
        color: "#fff",
        font: "600 15px/1.5 ui-monospace, Menlo, monospace",
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      {rows.map(([label, value]) => `${label.padEnd(15)}${value}`).join("\n")}
    </div>
  );
}
