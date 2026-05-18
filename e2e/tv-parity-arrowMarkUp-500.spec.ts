/**
 * TV-Parity 500 Tests — ARROW MARK UP tool
 *
 * 1-anchor stamp — green up-pointing chevron.
 * Rail: rail-brush
 * testId: tool-arrowMarkUp
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "arrowMarkUp",
  testId: "tool-arrowMarkUp",
  railTestId: "rail-brush",
  kind: "arrowMark",
  anchorCount: 1,
  commitMode: "click",
});
