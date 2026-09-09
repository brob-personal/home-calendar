/* A labelled block inside a Sheet. Moved verbatim from
   family-board.jsx:1694-1701. */
export function Field({ label, children }) {
  return (
    <div className="fb-field">
      <div className="fb-fieldlabel">{label}</div>
      {children}
    </div>
  );
}
