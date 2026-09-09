import { useState, useEffect, useMemo, useRef } from "react";

import { sameDay, DOW, MONTH_SHORT } from "../../lib/date.js";
import { CANVAS_W, CANVAS_H } from "../../lib/canvas.js";
import { PENS, NOTE_W, NOTE_H } from "./geometry.js";
import { drawStrokes } from "./drawStrokes.js";
import { Chevron, Cross } from "../shell/icons.jsx";

/*
  The draggable note window. Moved verbatim from family-board.jsx:1138-1297.

  Only today is editable; older notes are browsable read-only via the header
  chevrons. `keys` puts today at the front even when no note exists for it
  yet, so the pencil always opens onto a blank drawable page. Note that
  `index` is an index into a list derived from `notes`, and `notes` changes on
  every save — the `activeKey` fallback to `todayKey` is what keeps that from
  going out of bounds.

  Two defects are preserved here, both assigned elsewhere:

    - Deferred Defect #1, R12. `onUp` calls `onSave` from inside a
      `setStrokes` updater — a side effect in a reducer. Under StrictMode,
      which src/main.jsx enables deliberately in dev, updaters are
      double-invoked, so every finished stroke saves twice. Production builds
      are unaffected. The fix is to read the strokes and save outside the
      updater; R2 may not make it.
    - Deferred Defect #5, R12. App.jsx passes a `members` prop that this
      component has never destructured. It is dead on both sides. Left in
      place so the fix is one deletion at the call site rather than a hunt.

  Drag maths worth understanding before touching it: the window is positioned
  in canvas coordinates, but pointer events arrive in viewport pixels, and
  <Fit> has scaled everything by an arbitrary factor. `onDragStart` recovers
  that factor by comparing the header's rendered width against NOTE_W, then
  divides the pointer delta by it. Without that division the window slides
  faster or slower than the finger. The clamps keep it inside the board — the
  108px bottom margin clears the footer.
*/
export function NoteWindow({ notes, todayKey, now, onSave, onClose }) {
  const sorted = useMemo(() => [...notes].sort((a, b) => (a.key < b.key ? 1 : -1)), [notes]);
  const keys = useMemo(() => {
    const k = sorted.map((n) => n.key);
    return k.includes(todayKey) ? k : [todayKey, ...k];
  }, [sorted, todayKey]);

  const [index, setIndex] = useState(0);
  const activeKey = keys[index] ?? todayKey;
  const editable = activeKey === todayKey;

  const [strokes, setStrokes] = useState([]);
  const [pen, setPen] = useState(PENS[0]);
  const [width, setWidth] = useState(3);
  const [pos, setPos] = useState({ x: CANVAS_W - NOTE_W - 26, y: CANVAS_H - NOTE_H - 168 });

  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const current = useRef(null);

  /* Load whichever day is being viewed. */
  useEffect(() => {
    setStrokes(notes.find((n) => n.key === activeKey)?.strokes || []);
  }, [activeKey, notes]);

  useEffect(() => {
    drawStrokes(canvasRef.current, strokes, NOTE_W, NOTE_H);
  }, [strokes]);

  const commit = (next) => {
    setStrokes(next);
    if (editable) onSave(todayKey, next);
  };

  const pointFrom = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };

  const onDown = (e) => {
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    current.current = { color: pen, width, pts: [pointFrom(e)] };
    setStrokes((s) => [...s, current.current]);
  };
  const onMove = (e) => {
    if (!drawing.current || !current.current) return;
    current.current.pts.push(pointFrom(e));
    setStrokes((s) => [...s.slice(0, -1), { ...current.current }]);
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    current.current = null;
    setStrokes((s) => {
      if (editable) onSave(todayKey, s);
      return s;
    });
  };

  /* Drag the window by its header, clamped to the board. */
  const dragRef = useRef(null);
  const onDragStart = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const scale = r.width / NOTE_W;
    dragRef.current = { dx: e.clientX, dy: e.clientY, ox: pos.x, oy: pos.y, scale };
  };
  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = d.ox + (e.clientX - d.dx) / d.scale;
    const ny = d.oy + (e.clientY - d.dy) / d.scale;
    setPos({
      x: Math.min(CANVAS_W - NOTE_W - 8, Math.max(8, nx)),
      y: Math.min(CANVAS_H - NOTE_H - 108, Math.max(8, ny)),
    });
  };
  const onDragEnd = () => {
    dragRef.current = null;
  };

  const labelFor = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return sameDay(dt, now)
      ? "Today"
      : `${DOW[dt.getDay()]} ${MONTH_SHORT[dt.getMonth()]} ${dt.getDate()}`;
  };

  return (
    <div className="fb-notewrap" style={{ left: pos.x, top: pos.y, width: NOTE_W }}>
      <div
        className="fb-notehead"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <button
          className="fb-notenav"
          onClick={() => setIndex((i) => Math.min(keys.length - 1, i + 1))}
          disabled={index >= keys.length - 1}
          aria-label="Older note"
        >
          <Chevron dir="left" />
        </button>
        <span className="fb-notedate">{labelFor(activeKey)}</span>
        <button
          className="fb-notenav"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="Newer note"
        >
          <Chevron dir="right" />
        </button>
        <button className="fb-noteclose" onClick={onClose} aria-label="Close note">
          <Cross />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className={`fb-notecanvas${editable ? "" : " is-readonly"}`}
        style={{ width: NOTE_W, height: NOTE_H }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <div className="fb-notetools">
        {editable ? (
          <>
            <div className="fb-pens">
              {PENS.map((c) => (
                <button
                  key={c}
                  className={`fb-pen${pen === c ? " is-on" : ""}`}
                  style={{ background: c }}
                  onClick={() => setPen(c)}
                  aria-label="Pen color"
                />
              ))}
            </div>
            <div className="fb-widths">
              {[2, 3, 6].map((w) => (
                <button
                  key={w}
                  className={`fb-width${width === w ? " is-on" : ""}`}
                  onClick={() => setWidth(w)}
                  aria-label={`Stroke ${w}`}
                >
                  <span
                    style={{ width: w * 2 + 4, height: w * 2 + 4, background: "currentColor" }}
                  />
                </button>
              ))}
            </div>
            <button
              className="fb-noteact"
              onClick={() => commit(strokes.slice(0, -1))}
              disabled={!strokes.length}
            >
              Undo
            </button>
            <button className="fb-noteact" onClick={() => commit([])} disabled={!strokes.length}>
              Clear
            </button>
          </>
        ) : (
          <span className="fb-noteold">Saved note. Go back to today to draw.</span>
        )}
      </div>
    </div>
  );
}
