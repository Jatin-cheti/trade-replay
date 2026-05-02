/**
 * Trend-Based Fib Extension — TradingView parity.
 * Default levels: 0, 0.382, 0.5, 0.618, 1, 1.272, 1.414, 1.618, 2, 2.618, 3.618, 4.236.
 */
import { FibBaseTool, TV_DEFAULT_EXTENSION_LEVELS } from './fibBase.ts';
import type { DrawingVariant } from '../types.ts';

export class FibExtensionTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'fibExtension';
  readonly label = 'Trend-based Fib Extension';
  protected override getDefaultLevels(): readonly number[] {
    return TV_DEFAULT_EXTENSION_LEVELS;
  }
}
