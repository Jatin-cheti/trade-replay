/**
 * TV-Parity 500 Tests — ANCHORED VOLUME PROFILE tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   Single click places the anchor on a specific bar.
 *   From that anchor, a volume profile histogram renders to the right,
 *   showing cumulative volume at each price level from anchor to present.
 *   Profile is displayed as a sideways bar chart aligned with the price axis.
 *   POC (Point of Control) bar is highlighted.
 *
 * Rail: rail-forecasting
 * testId: tool-anchoredVolumeProfile
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "anchoredVolumeProfile",
  testId: "tool-anchoredVolumeProfile",
  railTestId: "rail-forecasting",
  kind: "volumeProfile",
  anchorCount: 1,
  commitMode: "click",
});
