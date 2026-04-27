/**
 * TV-Parity 500 Tests — Three Drives (7-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "threeDrives",
  testId: "tool-threeDrives",
  railTestId: "rail-patterns",
  anchorCount: 7,
  commitMode: "click-sequence",
});
