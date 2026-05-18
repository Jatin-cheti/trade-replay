/**
 * TV-Parity 500 Tests — ARC shape
 *
 * 2-anchor drag — circular arc spanning anchor[0] to anchor[1].
 * Rail: rail-brush
 * testId: tool-arc
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "arc",
  testId: "tool-arc",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
