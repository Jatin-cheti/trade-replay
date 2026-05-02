import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { GannBoxTool } from '../../src/drawing/tools/gannBox.ts';
generateFibGannParity500('GannBox parity (500)', {
  toolFactory: () => new GannBoxTool(),
  variant: 'gannBox',
  label: 'Gann Box',
  anchorCount: 2,
});
