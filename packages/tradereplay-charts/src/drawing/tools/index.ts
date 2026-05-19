/**
 * Drawing tools registry — exports all built-in tools and a factory function
 * that creates the default tool set for createDrawingEngine().
 */

// Line tools
export { TrendLineTool } from './trendLine.ts';
export { RayLineTool } from './rayLine.ts';
export { HorizontalLineTool } from './horizontalLine.ts';
export { VerticalLineTool } from './verticalLine.ts';
export { ExtendedLineTool } from './extendedLine.ts';
export { InfoLineTool } from './infoLine.ts';
export { TrendAngleTool } from './trendAngle.ts';
export { HorizontalRayTool } from './horizontalRay.ts';
export { CrossLineTool } from './crossLine.ts';

// Shape tools
export { RectangleTool } from './rectangle.ts';

// Fib/Gann shared exports
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
export { GannBoxTool } from './gannBox.ts';
export { GannSquareFixedTool } from './gannSquareFixed.ts';
export { GannSquareTool } from './gannSquare.ts';
export { GannFanTool } from './gannFan.ts';

// Channel tools
export { ParallelChannelTool } from './parallelChannel.ts';
export { RegressionTrendTool } from './regressionTrend.ts';
export { FlatTopBottomTool } from './flatTopBottom.ts';
export { DisjointChannelTool } from './disjointChannel.ts';

// Pitchfork tools
export {
  PitchforkTool,
  SchiffPitchforkTool,
  ModifiedSchiffPitchforkTool,
  InsidePitchforkTool,
} from './pitchforks.ts';

// Pattern tools
export {
  AbcdPatternTool,
  XabcdPatternTool,
  CypherPatternTool,
  HeadAndShouldersTool,
  TrianglePatternTool,
  ThreeDrivesTool,
  ElliottImpulseTool,
  ElliottCorrectionTool,
  ElliottTriangleTool,
  ElliottDoubleComboTool,
  ElliottTripleComboTool,
  SineLineTool,
  CyclicLinesTool,
  TimeCyclesTool,
} from './patternTools.ts';

import type { IDrawingTool } from '../types.ts';
import { TrendLineTool } from './trendLine.ts';
import { RayLineTool } from './rayLine.ts';
import { HorizontalLineTool } from './horizontalLine.ts';
import { VerticalLineTool } from './verticalLine.ts';
import { ExtendedLineTool } from './extendedLine.ts';
import { InfoLineTool } from './infoLine.ts';
import { TrendAngleTool } from './trendAngle.ts';
import { HorizontalRayTool } from './horizontalRay.ts';
import { CrossLineTool } from './crossLine.ts';
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
import { RegressionTrendTool } from './regressionTrend.ts';
import { FlatTopBottomTool } from './flatTopBottom.ts';
import { DisjointChannelTool } from './disjointChannel.ts';
import { GannBoxTool } from './gannBox.ts';
import { GannSquareFixedTool } from './gannSquareFixed.ts';
import { GannSquareTool } from './gannSquare.ts';
import { GannFanTool } from './gannFan.ts';
import {
  PitchforkTool,
  SchiffPitchforkTool,
  ModifiedSchiffPitchforkTool,
  InsidePitchforkTool,
} from './pitchforks.ts';
import {
  AbcdPatternTool,
  XabcdPatternTool,
  CypherPatternTool,
  HeadAndShouldersTool,
  TrianglePatternTool,
  ThreeDrivesTool,
  ElliottImpulseTool,
  ElliottCorrectionTool,
  ElliottTriangleTool,
  ElliottDoubleComboTool,
  ElliottTripleComboTool,
  SineLineTool,
  CyclicLinesTool,
  TimeCyclesTool,
} from './patternTools.ts';

/** Create the default set of built-in drawing tools. */
export function createDefaultTools(): IDrawingTool[] {
  return [
    // Lines
    new TrendLineTool(),
    new RayLineTool(),
    new HorizontalLineTool() as unknown as IDrawingTool,
    new VerticalLineTool() as unknown as IDrawingTool,
    new ExtendedLineTool(),
    new InfoLineTool(),
    new TrendAngleTool(),
    new HorizontalRayTool() as unknown as IDrawingTool,
    new CrossLineTool() as unknown as IDrawingTool,
    // Shapes
    new RectangleTool(),
    // Fib/Gann
    new FibRetracementTool() as unknown as IDrawingTool,
    new FibExtensionTool() as unknown as IDrawingTool,
    new FibChannelTool() as unknown as IDrawingTool,
    new FibTimeZoneTool() as unknown as IDrawingTool,
    new FibSpeedResistFanTool() as unknown as IDrawingTool,
    new FibTrendTimeTool() as unknown as IDrawingTool,
    new FibCirclesTool() as unknown as IDrawingTool,
    new FibSpiralTool() as unknown as IDrawingTool,
    new FibSpeedResistArcsTool() as unknown as IDrawingTool,
    new FibWedgeTool() as unknown as IDrawingTool,
    new PitchfanTool() as unknown as IDrawingTool,
    // Channels
    new ParallelChannelTool() as unknown as IDrawingTool,
    new RegressionTrendTool() as unknown as IDrawingTool,
    new FlatTopBottomTool() as unknown as IDrawingTool,
    new DisjointChannelTool() as unknown as IDrawingTool,
    // Gann
    new GannBoxTool() as unknown as IDrawingTool,
    new GannSquareFixedTool() as unknown as IDrawingTool,
    new GannSquareTool() as unknown as IDrawingTool,
    new GannFanTool() as unknown as IDrawingTool,
    // Pitchforks
    new PitchforkTool() as unknown as IDrawingTool,
    new SchiffPitchforkTool() as unknown as IDrawingTool,
    new ModifiedSchiffPitchforkTool() as unknown as IDrawingTool,
    new InsidePitchforkTool() as unknown as IDrawingTool,
    // Patterns
    new AbcdPatternTool() as unknown as IDrawingTool,
    new XabcdPatternTool() as unknown as IDrawingTool,
    new CypherPatternTool() as unknown as IDrawingTool,
    new HeadAndShouldersTool() as unknown as IDrawingTool,
    new TrianglePatternTool() as unknown as IDrawingTool,
    new ThreeDrivesTool() as unknown as IDrawingTool,
    new ElliottImpulseTool() as unknown as IDrawingTool,
    new ElliottCorrectionTool() as unknown as IDrawingTool,
    new ElliottTriangleTool() as unknown as IDrawingTool,
    new ElliottDoubleComboTool() as unknown as IDrawingTool,
    new ElliottTripleComboTool() as unknown as IDrawingTool,
    new SineLineTool() as unknown as IDrawingTool,
    new CyclicLinesTool() as unknown as IDrawingTool,
    new TimeCyclesTool() as unknown as IDrawingTool,
  ];
}
