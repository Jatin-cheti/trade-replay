import type { UTCTimestamp } from '@tradereplay/charts';
import { baseOptionSchema, defaultToolOptions, mergeToolOptions, type OptionField, type ToolOptions } from './toolOptions';

export type ToolCategory = 'cursor' | 'trend' | 'channel' | 'pitchfork' | 'fib' | 'gann' | 'shape' | 'text' | 'pattern' | 'elliott' | 'measure' | 'position' | 'system';

export type ToolFamily = 'line' | 'shape' | 'text' | 'fib' | 'pattern' | 'measure' | 'position' | 'system';

export type ToolVariant =
  | 'none'
  | 'trend'
  | 'ray'
  | 'extendedLine'
  | 'channel'
  | 'hline'
  | 'vline'
  | 'horizontalRay'
  | 'verticalLine'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'brush'
  | 'anchoredText'
  | 'note'
  | 'priceLabel'
  | 'callout'
  | 'comment'
  | 'pin'
  | 'emoji'
  | 'iconUp'
  | 'iconDown'
  | 'iconFlag'
  | 'measure'
  | 'zoom'
  | 'fibRetracement'
  | 'fibExtension'
  | 'fibChannel'
  | 'fibArcs'
  | 'fibFan'
  | 'fibSpiral'
  | 'fibTimeZones'
  | 'gannBox'
  | 'gannSquare'
  | 'gannFan'
  | 'pitchfork'
  | 'schiffPitchfork'
  | 'insidePitchfork'
  | 'xabcd'
  | 'trianglePattern'
  | 'headAndShoulders'
  | 'elliottImpulse'
  | 'elliottCorrection'
  | 'longPosition'
  | 'shortPosition';

export type DrawPoint = { time: UTCTimestamp; price: number };

export type ToolCapabilities = {
  anchors: number;
  draggable: boolean;
  resizable: boolean;
  supportsText: boolean;
  supportsFill: boolean;
  supportsLevels: boolean;
};

export type ToolDefinition = {
  id: ToolVariant;
  label: string;
  category: ToolCategory;
  family: ToolFamily;
  iconKey: string;
  capabilities: ToolCapabilities;
  optionsSchema: OptionField[];
  defaultOptions?: Partial<ToolOptions>;
  behaviors?: {
    shapeKind?: 'rectangle' | 'circle' | 'triangle';
    fibLevels?: number[];
  };
};

export type Drawing = {
  id: string;
  type: ToolFamily;
  variant: Exclude<ToolVariant, 'none'>;
  anchors: DrawPoint[];
  options: ToolOptions;
  selected: boolean;
  locked: boolean;
  visible: boolean;
  text?: string;
};

export type ToolState = {
  activeTool: ToolCategory | 'none';
  variant: ToolVariant;
  options: ToolOptions;
  drawings: Drawing[];
  history: Drawing[][];
  historyIndex: number;
};

const lineSchema = baseOptionSchema.filter((f) => !['font', 'textSize', 'bold', 'italic', 'align', 'textBackground', 'textBorder', 'textPadding'].includes(String(f.key)));
const textSchema = baseOptionSchema.filter((f) => !['extendLeft', 'extendRight', 'rayMode'].includes(String(f.key)));
const shapeSchema = baseOptionSchema.filter((f) => !['rayMode'].includes(String(f.key)));
const fibSchema = baseOptionSchema;

function def(input: Omit<ToolDefinition, 'optionsSchema'> & { optionsSchema?: OptionField[] }): ToolDefinition {
  return {
    ...input,
    optionsSchema: input.optionsSchema || baseOptionSchema,
  };
}

export const toolDefinitions: ToolDefinition[] = [
  def({ id: 'trend', label: 'Trend Line', category: 'trend', family: 'line', iconKey: 'Move3d', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'ray', label: 'Ray', category: 'trend', family: 'line', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, defaultOptions: { rayMode: true }, optionsSchema: lineSchema }),
  def({ id: 'extendedLine', label: 'Extended Line', category: 'trend', family: 'line', iconKey: 'ArrowRight', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, defaultOptions: { extendLeft: true, extendRight: true }, optionsSchema: lineSchema }),
  def({ id: 'channel', label: 'Parallel Channel', category: 'channel', family: 'line', iconKey: 'Layers', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: lineSchema }),

  def({ id: 'hline', label: 'Horizontal Line', category: 'trend', family: 'line', iconKey: 'Minus', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'vline', label: 'Vertical Line', category: 'trend', family: 'line', iconKey: 'Plus', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'horizontalRay', label: 'Horizontal Ray', category: 'trend', family: 'line', iconKey: 'ArrowRight', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, defaultOptions: { rayMode: true }, optionsSchema: lineSchema }),
  def({ id: 'verticalLine', label: 'Vertical Marker', category: 'trend', family: 'line', iconKey: 'SeparatorVertical', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  def({ id: 'rectangle', label: 'Rectangle', category: 'shape', family: 'shape', iconKey: 'RectangleHorizontal', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema, behaviors: { shapeKind: 'rectangle' } }),
  def({ id: 'circle', label: 'Circle', category: 'shape', family: 'shape', iconKey: 'Circle', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema, behaviors: { shapeKind: 'circle' } }),
  def({ id: 'triangle', label: 'Triangle', category: 'shape', family: 'shape', iconKey: 'Play', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema, behaviors: { shapeKind: 'triangle' } }),
  def({ id: 'brush', label: 'Brush', category: 'shape', family: 'shape', iconKey: 'PencilLine', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: shapeSchema }),

  def({ id: 'anchoredText', label: 'Anchored Text', category: 'text', family: 'text', iconKey: 'Type', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'note', label: 'Note', category: 'text', family: 'text', iconKey: 'MessageSquare', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'priceLabel', label: 'Price Label', category: 'text', family: 'text', iconKey: 'Tag', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'callout', label: 'Callout', category: 'text', family: 'text', iconKey: 'MessageCircle', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'comment', label: 'Comment', category: 'text', family: 'text', iconKey: 'MessageSquareText', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'pin', label: 'Pin', category: 'text', family: 'text', iconKey: 'Pin', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'emoji', label: 'Emoji', category: 'text', family: 'text', iconKey: 'Sparkles', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'iconUp', label: 'Icon Up', category: 'text', family: 'text', iconKey: 'ArrowUp', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'iconDown', label: 'Icon Down', category: 'text', family: 'text', iconKey: 'ArrowDown', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'iconFlag', label: 'Icon Flag', category: 'text', family: 'text', iconKey: 'Flag', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),

  def({ id: 'measure', label: 'Measure', category: 'measure', family: 'measure', iconKey: 'Ruler', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'zoom', label: 'Zoom', category: 'measure', family: 'measure', iconKey: 'ZoomIn', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  def({ id: 'fibRetracement', label: 'Fib Retracement', category: 'fib', family: 'fib', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema, behaviors: { fibLevels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] } }),
  def({ id: 'fibExtension', label: 'Fib Extension', category: 'fib', family: 'fib', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema, behaviors: { fibLevels: [0, 0.618, 1, 1.272, 1.618, 2] } }),
  def({ id: 'fibChannel', label: 'Fib Channel', category: 'fib', family: 'fib', iconKey: 'Layers3', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibArcs', label: 'Fib Arcs', category: 'fib', family: 'fib', iconKey: 'Circle', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibFan', label: 'Fib Fan', category: 'fib', family: 'fib', iconKey: 'Fan', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibSpiral', label: 'Fib Spiral', category: 'fib', family: 'fib', iconKey: 'Orbit', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibTimeZones', label: 'Fib Time Zones', category: 'fib', family: 'fib', iconKey: 'Clock3', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'gannBox', label: 'Gann Box', category: 'gann', family: 'fib', iconKey: 'Box', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'gannSquare', label: 'Gann Square', category: 'gann', family: 'fib', iconKey: 'Square', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'gannFan', label: 'Gann Fan', category: 'gann', family: 'fib', iconKey: 'Fan', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'pitchfork', label: 'Pitchfork', category: 'pitchfork', family: 'fib', iconKey: 'GitFork', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'schiffPitchfork', label: 'Schiff Pitchfork', category: 'pitchfork', family: 'fib', iconKey: 'GitFork', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'insidePitchfork', label: 'Inside Pitchfork', category: 'pitchfork', family: 'fib', iconKey: 'GitFork', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),

  def({ id: 'xabcd', label: 'XABCD Pattern', category: 'pattern', family: 'pattern', iconKey: 'GitMerge', capabilities: { anchors: 5, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'trianglePattern', label: 'Triangle Pattern', category: 'pattern', family: 'pattern', iconKey: 'Play', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'headAndShoulders', label: 'Head & Shoulders', category: 'pattern', family: 'pattern', iconKey: 'Mountain', capabilities: { anchors: 5, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'elliottImpulse', label: 'Elliott Impulse', category: 'elliott', family: 'pattern', iconKey: 'Activity', capabilities: { anchors: 5, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'elliottCorrection', label: 'Elliott Correction', category: 'elliott', family: 'pattern', iconKey: 'ActivitySquare', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  def({ id: 'longPosition', label: 'Long Position', category: 'position', family: 'position', iconKey: 'TrendingUp', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema }),
  def({ id: 'shortPosition', label: 'Short Position', category: 'position', family: 'position', iconKey: 'TrendingDown', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema }),
];

export const toolDefinitionMap = new Map(toolDefinitions.map((tool) => [tool.id, tool]));

export function getToolDefinition(id: ToolVariant): ToolDefinition | null {
  return toolDefinitionMap.get(id) || null;
}

const categoryMeta: Array<{ id: ToolCategory; label: string; railIcon: string }> = [
  { id: 'cursor', label: 'Cursor', railIcon: 'MousePointer2' },
  { id: 'trend', label: 'Trend Line', railIcon: 'Move3d' },
  { id: 'channel', label: 'Channels', railIcon: 'Layers' },
  { id: 'pitchfork', label: 'Pitchforks', railIcon: 'GitFork' },
  { id: 'fib', label: 'Fibonacci', railIcon: 'Waves' },
  { id: 'gann', label: 'Gann', railIcon: 'Box' },
  { id: 'pattern', label: 'Patterns', railIcon: 'GitMerge' },
  { id: 'elliott', label: 'Elliott Waves', railIcon: 'Activity' },
  { id: 'shape', label: 'Shapes', railIcon: 'RectangleHorizontal' },
  { id: 'text', label: 'Text', railIcon: 'Type' },
  { id: 'measure', label: 'Measure', railIcon: 'Ruler' },
  { id: 'position', label: 'Position', railIcon: 'TrendingUp' },
];

export const toolGroups: Array<{ id: ToolCategory; label: string; railIcon: string; variants: Array<{ id: ToolVariant; label: string; iconKey: string }> }> = categoryMeta
  .map((meta) => {
    const items = toolDefinitions.filter((tool) => tool.category === meta.id);
    if (!items.length) return null;
    return {
      id: meta.id,
      label: meta.label,
      railIcon: meta.railIcon,
      variants: items.map((tool) => ({ id: tool.id, label: tool.label, iconKey: tool.iconKey })),
    };
  })
  .filter(Boolean) as Array<{ id: ToolCategory; label: string; railIcon: string; variants: Array<{ id: ToolVariant; label: string; iconKey: string }> }>;

export const toolCursor: Record<ToolVariant, string> = toolDefinitions.reduce(
  (acc, tool) => ({ ...acc, [tool.id]: tool.family === 'text' ? 'text' : tool.id === 'zoom' ? 'zoom-in' : 'crosshair' }),
  { none: 'default' } as Record<ToolVariant, string>
);

export function buildToolOptions(variant: Exclude<ToolVariant, 'none'>): ToolOptions {
  const definition = getToolDefinition(variant);
  return mergeToolOptions(defaultToolOptions, definition?.defaultOptions || {});
}
