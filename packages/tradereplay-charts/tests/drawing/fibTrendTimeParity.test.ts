import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibTrendTimeTool } from '../../src/drawing/tools/fibTrendTime.ts';
generateFibGannParity500('FibTrendTime parity (500)', {
  toolFactory: () => new FibTrendTimeTool(),
  variant: 'fibTrendTime',
  label: 'Trend-based Fib Time',
  anchorCount: 2,
});
