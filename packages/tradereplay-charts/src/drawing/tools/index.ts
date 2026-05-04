/**
 * Drawing tools registry — exports all built-in tools and a factory function
 * that creates the default tool set for createDrawingEngine().
 */

export { TrendLineTool } from './trendLine.ts';
export { RayLineTool } from './rayLine.ts';
export { HorizontalLineTool } from './horizontalLine.ts';
export { VerticalLineTool } from './verticalLine.ts';
export { RectangleTool } from './rectangle.ts';

export {
  FibBaseTool,
  TV_FIB_COLORS,
  TV_DEFAULT_RETRACEMENT_LEVELS,
  TV_DEFAULT_EXTENSION_LEVELS,
  rgbFromHex,
  colorForFibLevel,
  formatFibLabel,
  resolveLevels,
} from './fibBase.ts';
export { FibRetracementTool } from './fibRetracement.ts';
export { FibExtensionTool } from './fibExtension.ts';
export { FibChannelTool } from './fibChannel.ts';
export { FibTimeZoneTool } from './fibTimeZone.ts';
export { FibSpeedResistFanTool } from './fibSpeedResistFan.ts';
export { FibTrendTimeTool } from './fibTrendTime.ts';
export { FibCirclesTool } from './fibCircles.ts';
export { FibSpiralTool } from './fibSpiral.ts';
export { FibSpeedResistArcsTool } from './fibSpeedResistArcs.ts';
export { FibWedgeTool } from './fibWedge.ts';
export { PitchfanTool } from './pitchfan.ts';
export { ParallelChannelTool } from './parallelChannel.ts';
export { DisjointChannelTool } from './disjointChannel.ts';
export { FlatTopBottomTool } from './flatTopBottom.ts';
export { SineLineTool } from './sineLine.ts';
export { GannBoxTool } from './gannBox.ts';
export { GannSquareFixedTool } from './gannSquareFixed.ts';
export { GannSquareTool } from './gannSquare.ts';
export { GannFanTool } from './gannFan.ts';

import type { IDrawingTool } from '../types.ts';
import { TrendLineTool } from './trendLine.ts';
import { RayLineTool } from './rayLine.ts';
import { HorizontalLineTool } from './horizontalLine.ts';
import { VerticalLineTool } from './verticalLine.ts';
import { RectangleTool } from './rectangle.ts';
import { FibRetracementTool } from './fibRetracement.ts';
import { FibExtensionTool } from './fibExtension.ts';
import { FibChannelTool } from './fibChannel.ts';
import { FibTimeZoneTool } from './fibTimeZone.ts';
import { FibSpeedResistFanTool } from './fibSpeedResistFan.ts';
import { FibTrendTimeTool } from './fibTrendTime.ts';
import { FibCirclesTool } from './fibCircles.ts';
import { FibSpiralTool } from './fibSpiral.ts';
import { FibSpeedResistArcsTool } from './fibSpeedResistArcs.ts';
import { FibWedgeTool } from './fibWedge.ts';
import { PitchfanTool } from './pitchfan.ts';
import { ParallelChannelTool } from './parallelChannel.ts';
import { DisjointChannelTool } from './disjointChannel.ts';
import { FlatTopBottomTool } from './flatTopBottom.ts';
import { SineLineTool } from './sineLine.ts';
import { GannBoxTool } from './gannBox.ts';
import { GannSquareFixedTool } from './gannSquareFixed.ts';
import { GannSquareTool } from './gannSquare.ts';
import { GannFanTool } from './gannFan.ts';

/** Create the default set of built-in drawing tools. */
export function createDefaultTools(): IDrawingTool[] {
  return [
    new TrendLineTool(),
    new RayLineTool(),
    new HorizontalLineTool() as unknown as IDrawingTool,
    new VerticalLineTool() as unknown as IDrawingTool,
    new RectangleTool(),
    new FibRetracementTool(),
    new FibExtensionTool(),
    new FibChannelTool(),
    new FibTimeZoneTool(),
    new FibSpeedResistFanTool(),
    new FibTrendTimeTool(),
    new FibCirclesTool(),
    new FibSpiralTool(),
    new FibSpeedResistArcsTool(),
    new FibWedgeTool(),
    new PitchfanTool() as unknown as IDrawingTool,
    new ParallelChannelTool(),
    new DisjointChannelTool(),
    new FlatTopBottomTool(),
    new SineLineTool(),
    new GannBoxTool(),
    new GannSquareFixedTool() as unknown as IDrawingTool,
    new GannSquareTool(),
    new GannFanTool(),
  ];
}

