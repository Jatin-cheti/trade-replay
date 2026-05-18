/**
 * TV-Parity 500 Tests — POSITION FORECAST (Forecast) tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   Same 3-click sequence as longPosition/shortPosition.
 *   No green/red fill zones — single translucent box between upper and lower.
 *   Label: "Forecast" with projected price range.
 *
 * Rail: rail-forecasting
 * testId: tool-positionForecast
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "positionForecast",
  testId: "tool-positionForecast",
  railTestId: "rail-forecasting",
  kind: "position",
  anchorCount: 3,
  commitMode: "click-sequence",
});
