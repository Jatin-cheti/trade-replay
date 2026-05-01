/**
 * TV-Parity 500 Tests — Parallel channel (3-anchor click-sequence).
 *
 * Click flow: P1=baseline start, P2=baseline end, P3=parallel-rail position.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "channel",
  testId: "tool-parallel-channel",
  anchorCount: 3,
  commitMode: "click-sequence",
});
