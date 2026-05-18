/**
 * TV-Parity 500 Tests — FIXED RANGE VOLUME PROFILE tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   Drag from left-date anchor to right-date anchor.
 *   Tool renders a horizontal histogram inside the drag rectangle,
 *   showing volume distribution across price levels for the selected date range.
 *   Point of Control (POC) bar is highlighted in a different color.
 *   Value Area High (VAH) and Value Area Low (VAL) may be shown as dotted lines.
 *
 * Rail: rail-forecasting
 * testId: tool-fixedRangeVolumeProfile
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "fixedRangeVolumeProfile",
  testId: "tool-fixedRangeVolumeProfile",
  railTestId: "rail-forecasting",
  kind: "volumeProfile",
  anchorCount: 2,
  commitMode: "drag",
});
