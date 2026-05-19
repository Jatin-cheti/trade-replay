/**
 * TV-Parity V2 — 500 comprehensive tests for "anchoredVwap".
 * 1-anchor single-click tool. VWAP line drawn from the anchor date forward.
 * TV shortcut: Alt+W. Rail: rail-forecasting  testId: tool-anchoredVwap
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "anchoredVwap",
  testId: "tool-anchoredVwap",
  railTestId: "rail-forecasting",
  kind: "vwap",
  anchorCount: 1,
  commitMode: "click",
});
