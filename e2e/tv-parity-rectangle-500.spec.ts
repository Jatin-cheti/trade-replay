/**
 * TV-Parity 500 Tests — RECTANGLE shape
 *
 * 2-anchor drag — opposite corners of an axis-aligned rectangle.
 * Rail: rail-brush
 * testId: tool-rectangle
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "rectangle",
  testId: "tool-rectangle",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
