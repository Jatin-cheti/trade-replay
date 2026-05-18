/**
 * TV-Parity 500 Tests — Sector tool (forecasting category)
 * 2-anchor drag-commit drawing, family='shape'.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "sector",
  testId: "tool-sector",
  railTestId: "rail-forecasting",
  anchorCount: 2,
  commitMode: "drag",
});
