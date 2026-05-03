/**
 * TV-Parity V2 — 500 comprehensive tests for "fibSpiral".
 * Tests: draw-variant(60), toolbar-color(60), toolbar-thickness(40),
 *        toolbar-style(40), toolbar-actions(60), selection(40),
 *        keyboard(50), undo-redo(50), persistence(40),
 *        multi-drawing(30), edge-cases(30)  = 500 total.
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "fibSpiral",
  testId: "fib-spiral",
  railTestId: "rail-fib",
});
