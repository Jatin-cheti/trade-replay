import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { GannFanTool } from '../../src/drawing/tools/gannFan.ts';
generateFibGannParity500('GannFan parity (500)', {
  toolFactory: () => new GannFanTool(),
  variant: 'gannFan',
  label: 'Gann Fan',
  anchorCount: 2,
});
