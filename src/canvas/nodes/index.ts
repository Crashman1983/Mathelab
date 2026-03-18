/**
 * Canvas Node System — barrel export.
 *
 * Usage:
 *   import { vstack, hstack, text, button, spacer } from "@canvas/nodes";
 */

// Types
export type {
  CanvasNode,
  MeasuredSize,
  Rect,
  Size,
  Point,
  TextStyle,
  ButtonStyle,
  PanelStyle,
  ShapeStyle,
  StackOptions,
  GridOptions,
  SceneHitArea,
} from "./types";
export { MIN_TOUCH_TARGET, DEFAULT_MEASURED, DEFAULT_RECT } from "./types";

// Base
export { BaseNode } from "./base";

// Containers
export {
  VStack,
  HStack,
  ZStack,
  GridNode,
  Spacer,
  vstack,
  hstack,
  zstack,
  grid,
  spacer,
} from "./container";

// Leaf nodes
export { TextNode, text } from "./text";
export { ButtonNode, button } from "./button";
export { ShapeNode, rect, circle } from "./shape";
export { CustomDrawNode, custom } from "./custom";
export { PanelNode, panel } from "./panel";
