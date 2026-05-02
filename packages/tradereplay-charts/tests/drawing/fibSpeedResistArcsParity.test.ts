import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { FibSpeedResistArcsTool } from '../../src/drawing/tools/fibSpeedResistArcs.ts';
generateFibGannParity500('FibSpeedResistArcs parity (500)', {
  toolFactory: () => new FibSpeedResistArcsTool(),
  variant: 'fibSpeedResistArcs',
  label: 'Fib Speed Resistance Arcs',
  anchorCount: 2,
});
