/**
 * TV-Parity 500 Tests — ARROW MARK DOWN tool
 *
 * 1-anchor stamp — red down-pointing chevron.
 * Rail: rail-brush
 * testId: tool-arrowMarkDown
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "arrowMarkDown",
  testId: "tool-arrowMarkDown",
  railTestId: "rail-brush",
  kind: "arrowMark",
  anchorCount: 1,
  commitMode: "click",
});
