/**
 * Fib Retracement — TradingView parity.
 *
 * Anchor count: 2 (drag from swing high to swing low, or vice versa).
 * Levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236.
 * Renders horizontal level lines, per-level colored `<ratio> (<price>)`
 * labels, filled bands between adjacent levels, and a dashed grey diagonal
 * connecting the two anchors.
 */
import { FibBaseTool, TV_DEFAULT_RETRACEMENT_LEVELS } from './fibBase.ts';
import type { DrawingVariant } from '../types.ts';

export class FibRetracementTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'fibRetracement';
  readonly label = 'Fib Retracement';
  protected override getDefaultLevels(): readonly number[] {
    return TV_DEFAULT_RETRACEMENT_LEVELS;
  }
}
