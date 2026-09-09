import { Component } from "react";

/*
  PLAN.md §R12 item 4: "Error boundary plus loading / offline / failure UI.
  There is none today." This is the error boundary half — main.jsx wraps
  <App> in it, so a render throw anywhere in the tree (a bad migration, a
  malformed event from a source, anything) lands here instead of unmounting
  React and leaving a blank white screen.

  Deliberately styled inline rather than through tokens.css/BoardStyles: the
  whole point of this component is to still render something coherent when
  something upstream — potentially BoardStyles itself — has failed.

  This board runs unattended on a wall with nobody to tap "Reload", so the
  fallback also schedules one itself. A crash is assumed transient (a bad
  network response, a race during a sync) rather than a permanent code
  defect, since the latter would just crash again identically after reload —
  that case still needs a human, which is why the message and the manual
  button stay visible instead of only auto-reloading silently forever.
*/
const AUTO_RELOAD_MS = 30_000;

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[board] render error, falling back:", error, info.componentStack);
    this.reloadTimer = setTimeout(() => window.location.reload(), AUTO_RELOAD_MS);
  }

  componentWillUnmount() {
    clearTimeout(this.reloadTimer);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "#23262D",
          color: "#F5F1E8",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 32,
        }}
      >
        <div>
          <p style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>
            The board hit a problem and needs to restart.
          </p>
          <p style={{ fontSize: 15, opacity: 0.75, margin: "0 0 22px" }}>
            Reloading automatically in a moment — nothing to do.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              font: "inherit",
              fontSize: 15,
              fontWeight: 600,
              padding: "12px 22px",
              minHeight: 44,
              borderRadius: 10,
              border: "none",
              background: "#F5F1E8",
              color: "#23262D",
              cursor: "pointer",
            }}
          >
            Reload now
          </button>
        </div>
      </div>
    );
  }
}
