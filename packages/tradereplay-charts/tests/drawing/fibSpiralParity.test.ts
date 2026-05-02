import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibSpiralTool } from '../../src/drawing/tools/fibSpiral.ts';
generateFibGannParity500('FibSpiral parity (500)', {
  toolFactory: () => new FibSpiralTool(),
  variant: 'fibSpiral',
  label: 'Fib Spiral',
  anchorCount: 2,
});
