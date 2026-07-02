export {
  getElementProps,
  editElementProps,
  deleteElement,
  insertComponent,
  duplicateElement,
  moveElement,
  getSfcBlocks,
  updateSfcBlock,
  COMPONENT_CATALOG,
} from "./editor";
export type {
  PropEntry,
  ElementProps,
  ComponentSchema,
  MoveDirection,
  SfcBlockKind,
  SfcBlock,
} from "./editor";
export { createDevServer } from "./server";
