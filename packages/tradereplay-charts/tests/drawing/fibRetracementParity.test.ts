import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibRetracementTool } from '../../src/drawing/tools/fibRetracement.ts';
generateFibGannParity500('FibRetracement parity (500)', {
  toolFactory: () => new FibRetracementTool(),
  variant: 'fibRetracement',
  label: 'Fib Retracement',
  anchorCount: 2,
});
