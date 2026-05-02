import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibTimeZoneTool } from '../../src/drawing/tools/fibTimeZone.ts';
generateFibGannParity500('FibTimeZone parity (500)', {
  toolFactory: () => new FibTimeZoneTool(),
  variant: 'fibTimeZone',
  label: 'Fib Time Zone',
  anchorCount: 2,
});
