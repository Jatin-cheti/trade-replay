/**
 * TV-Parity 500 Tests — PATH shape
 *
 * 2-anchor drag — open polyline path between the two anchors.
 * Rail: rail-brush
 * testId: tool-path
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "path",
  testId: "tool-path",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
