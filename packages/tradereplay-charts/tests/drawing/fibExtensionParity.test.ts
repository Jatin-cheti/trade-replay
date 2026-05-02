import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibExtensionTool } from '../../src/drawing/tools/fibExtension.ts';
generateFibGannParity500('FibExtension parity (500)', {
  toolFactory: () => new FibExtensionTool(),
  variant: 'fibExtension',
  label: 'Trend-based Fib Extension',
  anchorCount: 2,
});
