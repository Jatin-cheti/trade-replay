import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibSpeedResistFanTool } from '../../src/drawing/tools/fibSpeedResistFan.ts';
generateFibGannParity500('FibSpeedResistFan parity (500)', {
  toolFactory: () => new FibSpeedResistFanTool(),
  variant: 'fibSpeedResistFan',
  label: 'Fib Speed Resistance Fan',
  anchorCount: 2,
});
