import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { GannSquareFixedTool } from '../../src/drawing/tools/gannSquareFixed.ts';
generateFibGannParity500('GannSquareFixed parity (500)', {
  toolFactory: () => new GannSquareFixedTool(),
  variant: 'gannSquareFixed',
  label: 'Gann Square Fixed',
  anchorCount: 1,
});
