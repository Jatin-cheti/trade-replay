/**
 * TV-Parity 500 Tests — ARROW (line) tool
 *
 * 2-anchor drag — straight line ending in an arrowhead at anchor[1].
 * Rail: rail-brush
 * testId: tool-arrowTool
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "arrowTool",
  testId: "tool-arrowTool",
  railTestId: "rail-brush",
  kind: "arrowLine",
  anchorCount: 2,
  commitMode: "drag",
});
