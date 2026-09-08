## Purpose

Adds right-click context menu support to `__vdi-action-btn` elements in the overlay UI. This ensures users can always access the context menu (for copy, delete, insert, etc.) even when the button is partially obscured by small component bounds.

## ADDED Requirements

### Requirement: Action buttons support right-click context menu
The overlay SHALL show the `__vdi-context-menu` on right-click (contextmenu event) of any `.vdi-action-btn` element.

#### Scenario: Right-click on action button
- **WHEN** user right-clicks (or contextmenu fires) on `.vdi-action-btn`
- **THEN** the context menu appears near the cursor, stays open while mouse is down, and responds to menu item clicks

### Requirement: Context menu remains accessible for small components
When the inspected component is small and the action button is outside its visible area, the button SHALL still be clickable via right-click to open the context menu.

## Impact

- Overlay UI event handling in inspector.ts and events.ts
- No change to existing left-click behavior or menu items