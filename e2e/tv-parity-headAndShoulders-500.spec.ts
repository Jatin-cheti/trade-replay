/**
 * TV-Parity 500 Tests — Head and Shoulders (5-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "headAndShoulders",
  testId: "tool-headAndShoulders",
  railTestId: "rail-patterns",
  anchorCount: 5,
  commitMode: "click-sequence",
});
