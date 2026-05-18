/**
 * TV-Parity 500 Tests — ANCHORED VWAP tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   Single click places the VWAP anchor on a specific candle bar.
 *   From that anchor, a VWAP line extends to the right through all subsequent bars,
 *   computed as cumulative(typical_price × volume) / cumulative(volume).
 *   TV supports VWAP interval modes: session, week, month, quarter, year.
 *   The line label shows "VWAP" at the right end.
 *
 * TV keyboard shortcut: Alt+W
 * Rail: rail-forecasting
 * testId: tool-anchoredVwap
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "anchoredVwap",
  testId: "tool-anchoredVwap",
  railTestId: "rail-forecasting",
  kind: "vwap",
  anchorCount: 1,
  commitMode: "click",
});
