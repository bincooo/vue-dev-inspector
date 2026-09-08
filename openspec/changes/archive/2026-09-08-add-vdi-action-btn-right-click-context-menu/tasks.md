## 1. Overlay Event Handling

- [x] 1.1 Add right-click (contextmenu) event listener to `.vdi-action-btn` elements in `packages/overlay/src/inspector.ts`
- [x] 1.2 Implement context menu showing logic (reuse existing `__vdi-context-menu` handler) near cursor

## 2. CSS/Positioning Adjustments

- [x] 2.1 Ensure context menu z-index is higher than buttons (if needed for off-screen buttons)
- [x] 2.2 Verify menu positioning works when button is outside component bounds

## 3. Testing

- [x] 3.1 Test right-click on action button for small components (e.g., `<a>` tag)
- [x] 3.2 Verify left-click behavior unchanged
- [x] 3.3 Test with Monaco editor (no conflict)