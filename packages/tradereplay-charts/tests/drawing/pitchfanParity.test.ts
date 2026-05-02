import { generateFibGannParity500 } from './fibGannParity.shared.ts';
import { PitchfanTool } from '../../src/drawing/tools/pitchfan.ts';
generateFibGannParity500('Pitchfan parity (500)', {
  toolFactory: () => new PitchfanTool(),
  variant: 'pitchfan',
  label: 'Pitchfan',
  anchorCount: 3,
});
