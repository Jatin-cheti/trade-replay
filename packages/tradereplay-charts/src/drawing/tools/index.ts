/**
 * Drawing tools registry — exports all built-in tools and a factory function
 * that creates the default tool set for createDrawingEngine().
 */

export { TrendLineTool } from './trendLine.ts';
export { RayLineTool } from './rayLine.ts';
export { HorizontalLineTool } from './horizontalLine.ts';
export { VerticalLineTool } from './verticalLine.ts';
export { RectangleTool } from './rectangle.ts';

import type { IDrawingTool } from '../types.ts';
import { TrendLineTool } from './trendLine.ts';
import { RayLineTool } from './rayLine.ts';
import { HorizontalLineTool } from './horizontalLine.ts';
import { VerticalLineTool } from './verticalLine.ts';
import { RectangleTool } from './rectangle.ts';

/** Create the default set of built-in drawing tools. */
export function createDefaultTools(): IDrawingTool[] {
  return [
    new TrendLineTool(),
    new RayLineTool(),
    new HorizontalLineTool() as unknown as IDrawingTool,
    new VerticalLineTool() as unknown as IDrawingTool,
    new RectangleTool(),
  ];
}
