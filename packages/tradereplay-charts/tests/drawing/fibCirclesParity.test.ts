import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibCirclesTool } from '../../src/drawing/tools/fibCircles.ts';
generateFibGannParity500('FibCircles parity (500)', {
  toolFactory: () => new FibCirclesTool(),
  variant: 'fibCircles',
  label: 'Fib Circles',
  anchorCount: 2,
});
