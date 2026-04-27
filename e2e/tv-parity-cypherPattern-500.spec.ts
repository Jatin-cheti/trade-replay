/**
 * TV-Parity 500 Tests — Cypher pattern (5-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "cypherPattern",
  testId: "tool-cypherPattern",
  railTestId: "rail-patterns",
  anchorCount: 5,
  commitMode: "click-sequence",
});
