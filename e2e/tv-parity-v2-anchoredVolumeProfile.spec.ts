/**
 * TV-Parity V2 — 500 comprehensive tests for "anchoredVolumeProfile".
 * 1-anchor single-click. Volume profile histogram anchored from a start date.
 * Rail: rail-forecasting  testId: tool-anchoredVolumeProfile
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "anchoredVolumeProfile",
  testId: "tool-anchoredVolumeProfile",
  railTestId: "rail-forecasting",
  kind: "volumeProfile",
  anchorCount: 1,
  commitMode: "click",
});
