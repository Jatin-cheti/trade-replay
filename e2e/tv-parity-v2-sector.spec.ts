/**
 * TV-Parity V2 — 500 comprehensive tests for "sector".
 * 2-anchor drag-commit wedge shape. family=shape, supportsFill=true.
 * TradingView menu: Forecasting category.
 * Rail: rail-forecasting  testId: tool-sector
 *
 * Note: sector is not in tv-capture-factory ALL_CAPTURE_TOOLS —
 * no TradingView aria-label captured. Our app implements it as a
 * geometric shape with fill. Coverage tracks our app behavior only.
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "sector",
  testId: "tool-sector",
  railTestId: "rail-forecasting",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
