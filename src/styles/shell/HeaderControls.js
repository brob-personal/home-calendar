/*
  fb-headdd/fb-ddpop/fb-ddopt/fb-ddscrim are the shared dropdown mechanics
  ViewSwitcher and MemberPicker both build on — one popover recipe, same as
  fb-chip (Header.js) and fb-primary (Sheet.js) already being shared across
  unrelated files.
*/
export default `
.fb-headright { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.fb-headdd { position: relative; }
.fb-ddscrim { position: fixed; inset: 0; z-index: 30; }
.fb-ddpop {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 31;
  min-width: 160px; padding: 6px; border-radius: 12px;
  background: var(--paper); box-shadow: 0 12px 32px var(--shadow-sheet);
  display: flex; flex-direction: column; gap: 2px;
  transform-origin: top right;
  animation: fb-dd-grow .16s ease-out;
}
.fb-ddpop--closing { animation: fb-dd-shrink .16s ease-in forwards; }
@keyframes fb-dd-grow {
  from { transform: scale(.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes fb-dd-shrink {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(.9); opacity: 0; }
}
.fb-ddopt {
  font-size: 14px; font-weight: 600; color: var(--ink); text-align: left;
  padding: 9px 12px; border-radius: 8px; white-space: nowrap;
}
.fb-ddopt:hover, .fb-ddopt:focus-visible { background: var(--surface); }
`;
