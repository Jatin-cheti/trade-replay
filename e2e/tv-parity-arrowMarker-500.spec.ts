/**
 * TV-Parity 500 Tests — ARROW MARKER tool
 *
 * 1-anchor stamp tool — single click drops a marker glyph.
 * Rail: rail-brush
 * testId: tool-arrowMarker
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "arrowMarker",
  testId: "tool-arrowMarker",
  railTestId: "rail-brush",
  kind: "arrowMark",
  anchorCount: 1,
  commitMode: "click",
});
