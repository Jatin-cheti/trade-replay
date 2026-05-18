/**
 * TV-Parity 500 Tests — CIRCLE shape
 *
 * 2-anchor drag — anchor[0] center, anchor[1] perimeter.
 * Rail: rail-brush
 * testId: tool-circle
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "circle",
  testId: "tool-circle",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
