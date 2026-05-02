import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibChannelTool } from '../../src/drawing/tools/fibChannel.ts';
generateFibGannParity500('FibChannel parity (500)', {
  toolFactory: () => new FibChannelTool(),
  variant: 'fibChannel',
  label: 'Fib Channel',
  anchorCount: 2,
});
