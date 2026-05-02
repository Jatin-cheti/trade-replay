import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { GannSquareTool } from '../../src/drawing/tools/gannSquare.ts';
generateFibGannParity500('GannSquare parity (500)', {
  toolFactory: () => new GannSquareTool(),
  variant: 'gannSquare',
  label: 'Gann Square',
  anchorCount: 2,
});
