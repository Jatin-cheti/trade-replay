/**
 * TV-Parity 500 Tests — HIGHLIGHTER tool
 *
 * Behaviors captured from TradingView via tv-capture-brushes-arrows-shapes.spec.ts.
 * Same shape as brush but rendered with translucent fill / wider stroke.
 *
 * Rail: rail-brush
 * testId: tool-highlighter
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "highlighter",
  testId: "tool-highlighter",
  railTestId: "rail-brush",
  kind: "brush",
  anchorCount: 2,
  commitMode: "drag",
});
