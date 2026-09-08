## Context

The overlay UI uses a single mutable `state` object in `packages/overlay/src/state.ts`. Action buttons are rendered in `packages/overlay/src/inspector.ts` and attached click handlers in `packages/overlay/src/events.ts`. The context menu is a floating div with absolute positioning and event listeners for hover/mouse interactions.

## Goals / Non-Goals

**Goals:**
- Make action buttons right-clickable to open the existing context menu.
- Ensure context menu appears near cursor and stays responsive even if button is off-screen.

**Non-Goals:**
- Separate new context menu; reuse existing `__vdi-context-menu`.
- Change left-click behavior or menu item logic.
- Modify core inspection logic or AST editing.

## Decisions

**Decision: Use existing context menu for action buttons**

- **Why?** The context menu already exists and handles copy/delete/insert/move operations uniformly. Adding right-click to buttons reuses this without duplicating menu code.
- **Alternative considered:** Create a new menu only for action buttons — rejected as it would duplicate code and require maintaining two similar UIs.
- **Alternative considered:** Position buttons always inside component bounds — rejected as it would break the design for small components and require layout changes.

**Decision: Attach right-click listener directly to button elements**

- **Why?** Simple and performant (no global listeners needed). Buttons are already created as DOM elements with class `__vdi-action-btn`.
- **Alternative considered:** Use a single global contextmenu listener on document — more complex, could interfere with other right-clicks (e.g., in Monaco editor). Rejected for simplicity.

**Decision: Use pointer-events or z-index adjustment if needed**

- **Why?** Context menu uses fixed positioning; if button is behind menu, ensure menu stays on top.
- **Alternative considered:** Force button to top layer via CSS — rejected as it could conflict with other overlay elements (prop panel, code drawer).

## Risks / Trade-offs

- **Risk:** Right-click could conflict with system context menus or Monaco editor's right-click — Mitigation: Use `event.preventDefault()` and check target class.
- **Risk:** Menu positioning when button is far off-screen — Mitigation: Use cursor position for anchor point (not button position).
- **Trade-off:** Slightly more complex event handling in inspector.ts vs pure click handlers — but improves UX for small components.

## Migration Plan

- No migration needed (pure addition).
- Rollback: Remove right-click listener and CSS if needed (rare).

## Open Questions

None.