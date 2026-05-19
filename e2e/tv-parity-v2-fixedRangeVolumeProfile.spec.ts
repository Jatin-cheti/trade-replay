/**
 * TV-Parity V2 — 500 comprehensive tests for "fixedRangeVolumeProfile".
 * 2-anchor drag-commit. Renders a volume histogram for the dragged time range.
 * Rail: rail-forecasting  testId: tool-fixedRangeVolumeProfile
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "fixedRangeVolumeProfile",
  testId: "tool-fixedRangeVolumeProfile",
  railTestId: "rail-forecasting",
  kind: "volumeProfile",
  anchorCount: 2,
  commitMode: "drag",
});
