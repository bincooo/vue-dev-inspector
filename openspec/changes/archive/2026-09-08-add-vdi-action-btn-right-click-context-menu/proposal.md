## Why

The action button (`.vdi-action-btn`) is a small floating control in the overlay UI. When the inspected component is small, the button can be positioned outside its visible bounds, making it hard for users to click with the mouse. Adding right-click support allows users to open the context menu from anywhere the button is visible, improving accessibility and usability for small components or when the button is off-screen.

## What Changes

- Add right-click event listener to `.vdi-action-btn` elements in the overlay.
- On right-click, show the existing `__vdi-context-menu` floating list (or enhance it if needed).
- Ensure the menu appears near the cursor and remains clickable even when the button is partially hidden.

## Capabilities

### New Capabilities

- `action-btn-context-menu`: Right-click support on action buttons to open context menu for better accessibility when button is hard to click.

## Impact

- Affects `packages/overlay/src/inspector.ts` and `events.ts` (button click handlers).
- Overlay UI behavior for small components.