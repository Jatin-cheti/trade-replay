import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibWedgeTool } from '../../src/drawing/tools/fibWedge.ts';
generateFibGannParity500('FibWedge parity (500)', {
  toolFactory: () => new FibWedgeTool(),
  variant: 'fibWedge',
  label: 'Fib Wedge',
  anchorCount: 2,
});
