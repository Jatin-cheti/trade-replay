import type { UTCTimestamp } from '@tradereplay/charts';
import { baseOptionSchema, defaultToolOptions, mergeToolOptions, type OptionField, type ToolOptions } from './toolOptions.ts';

/** Rail-level categories — each gets a rail button + popover menu */
export type ToolCategory = 'cursor' | 'lines' | 'fib' | 'patterns' | 'forecasting' | 'brush' | 'text' | 'icon' | 'system';

export type ToolFamily = 'line' | 'shape' | 'text' | 'fib' | 'pattern' | 'measure' | 'position' | 'system';

/** Subsections within a category menu (e.g. Lines → LINES / CHANNELS / PITCHFORKS) */
export type ToolSubSection = string;

export type CursorMode = 'cross' | 'dot' | 'arrow' | 'demo' | 'eraser';

export type ToolVariant =
  | 'none'
  /* Lines → Lines */
  | 'trend'
  | 'ray'
  | 'infoLine'
  | 'extendedLine'
  | 'trendAngle'
  | 'hline'
  | 'horizontalRay'
  | 'vline'
  | 'crossLine'
  /* Lines → Channels */
  | 'channel'
  | 'regressionTrend'
  | 'flatTopBottom'
  | 'disjointChannel'
  /* Lines → Pitchforks */
  | 'pitchfork'
  | 'schiffPitchfork'
  | 'modifiedSchiffPitchfork'
  | 'insidePitchfork'
  /* Fibonacci */
  | 'fibRetracement'
  | 'fibExtension'
  | 'fibChannel'
  | 'fibTimeZone'
  | 'fibSpeedResistFan'
  | 'fibTrendTime'
  | 'fibCircles'
  | 'fibSpiral'
  | 'fibSpeedResistArcs'
  | 'fibWedge'
  | 'pitchfan'
  /* Gann (in fib category) */
  | 'gannBox'
  | 'gannSquareFixed'
  | 'gannSquare'
  | 'gannFan'
  /* Patterns → Chart Patterns */
  | 'xabcd'
  | 'cypherPattern'
  | 'headAndShoulders'
  | 'abcdPattern'
  | 'trianglePattern'
  | 'threeDrives'
  /* Patterns → Elliott Waves */
  | 'elliottImpulse'
  | 'elliottCorrection'
  | 'elliottTriangle'
  | 'elliottDoubleCombo'
  | 'elliottTripleCombo'
  /* Patterns → Cycles */
  | 'cyclicLines'
  | 'timeCycles'
  | 'sineLine'
  /* Forecasting */
  | 'longPosition'
  | 'shortPosition'
  | 'positionForecast'
  | 'barPattern'
  | 'ghostFeed'
  | 'sector'
  /* Volume-based (in forecasting) */
  | 'anchoredVwap'
  | 'fixedRangeVolumeProfile'
  | 'anchoredVolumeProfile'
  /* Measurers (in forecasting) */
  | 'priceRange'
  | 'dateRange'
  | 'dateAndPriceRange'
  /* Brush — Brushes */
  | 'brush'
  | 'highlighter'
  /* Brush — Arrows */
  | 'arrowMarker'
  | 'arrowTool'
  | 'arrowMarkUp'
  | 'arrowMarkDown'
  /* Brush — Shapes */
  | 'rectangle'
  | 'rotatedRectangle'
  | 'path'
  | 'circle'
  | 'ellipse'
  | 'polyline'
  | 'triangle'
  | 'arc'
  | 'curveTool'
  | 'doubleCurve'
  /* Text — Text and Notes */
  | 'plainText'
  | 'anchoredText'
  | 'note'
  | 'priceNote'
  | 'pin'
  | 'table'
  | 'callout'
  | 'comment'
  | 'priceLabel'
  | 'signpost'
  | 'flagMark'
  /* Text — Content */
  | 'image'
  | 'post'
  | 'idea'
  /* Icon */
  | 'emoji'
  | 'sticker'
  | 'iconTool'
  /* Legacy aliases kept for compat */
  | 'measure'
  | 'zoom';

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
  subSection?: ToolSubSection;
  family: ToolFamily;
  iconKey: string;
  implemented: boolean;
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

/** All categories are fully implemented — no "Soon" badges anywhere. */
function def(input: Omit<ToolDefinition, 'optionsSchema' | 'implemented'> & { optionsSchema?: OptionField[]; implemented?: boolean }): ToolDefinition {
  return {
    ...input,
    implemented: true,
    optionsSchema: input.optionsSchema || baseOptionSchema,
  };
}

export const toolDefinitions: ToolDefinition[] = [
  /* ── Lines → LINES ──────────────────────────────────────────── */
  def({ id: 'trend', label: 'Trend line', category: 'lines', subSection: 'Lines', family: 'line', iconKey: 'TrendingUp', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'ray', label: 'Ray', category: 'lines', subSection: 'Lines', family: 'line', iconKey: 'ArrowRight', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, defaultOptions: { rayMode: true }, optionsSchema: lineSchema }),
  def({ id: 'infoLine', label: 'Info line', category: 'lines', subSection: 'Lines', family: 'line', iconKey: 'Info', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'extendedLine', label: 'Extended line', category: 'lines', subSection: 'Lines', family: 'line', iconKey: 'MoveHorizontal', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, defaultOptions: { extendLeft: true, extendRight: true }, optionsSchema: lineSchema }),
  def({ id: 'trendAngle', label: 'Trend angle', category: 'lines', subSection: 'Lines', family: 'line', iconKey: 'CornerRightUp', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'hline', label: 'Horizontal line', category: 'lines', subSection: 'Lines', family: 'line', iconKey: 'Minus', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'horizontalRay', label: 'Horizontal ray', category: 'lines', subSection: 'Lines', family: 'line', iconKey: 'MoveRight', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, defaultOptions: { rayMode: true }, optionsSchema: lineSchema }),
  def({ id: 'vline', label: 'Vertical line', category: 'lines', subSection: 'Lines', family: 'line', iconKey: 'SeparatorVertical', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'crossLine', label: 'Cross line', category: 'lines', subSection: 'Lines', family: 'line', iconKey: 'Crosshair', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  /* ── Lines → CHANNELS ───────────────────────────────────────── */
  def({ id: 'channel', label: 'Parallel channel', category: 'lines', subSection: 'Channels', family: 'line', iconKey: 'Layers', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'regressionTrend', label: 'Regression trend', category: 'lines', subSection: 'Channels', family: 'line', iconKey: 'TrendingUp', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'flatTopBottom', label: 'Flat top/bottom', category: 'lines', subSection: 'Channels', family: 'line', iconKey: 'AlignHorizontalSpaceAround', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'disjointChannel', label: 'Disjoint channel', category: 'lines', subSection: 'Channels', family: 'line', iconKey: 'Unlink', capabilities: { anchors: 4, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: lineSchema }),

  /* ── Lines → PITCHFORKS ─────────────────────────────────────── */
  def({ id: 'pitchfork', label: 'Pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', iconKey: 'GitFork', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'schiffPitchfork', label: 'Schiff pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', iconKey: 'GitFork', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'modifiedSchiffPitchfork', label: 'Modified Schiff pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', iconKey: 'GitFork', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'insidePitchfork', label: 'Inside pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', iconKey: 'GitFork', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),

  /* ── Fibonacci ──────────────────────────────────────────────── */
  def({ id: 'fibRetracement', label: 'Fib retracement', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema, behaviors: { fibLevels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] } }),
  def({ id: 'fibExtension', label: 'Trend-based fib extension', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema, behaviors: { fibLevels: [0, 0.618, 1, 1.272, 1.618, 2] } }),
  def({ id: 'fibChannel', label: 'Fib channel', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Layers3', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibTimeZone', label: 'Fib time zone', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Clock3', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibSpeedResistFan', label: 'Fib speed resistance fan', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Fan', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibTrendTime', label: 'Trend-based fib time', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Clock3', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibCircles', label: 'Fib circles', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Circle', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibSpiral', label: 'Fib spiral', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Orbit', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibSpeedResistArcs', label: 'Fib speed resistance arcs', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Circle', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'fibWedge', label: 'Fib wedge', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Triangle', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'pitchfan', label: 'Pitchfan', category: 'fib', subSection: 'Fibonacci', family: 'fib', iconKey: 'Fan', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),

  /* ── Gann (in Fibonacci + Gann menu) ────────────────────────── */
  def({ id: 'gannBox', label: 'Gann box', category: 'fib', subSection: 'Gann', family: 'fib', iconKey: 'Box', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'gannSquareFixed', label: 'Gann square fixed', category: 'fib', subSection: 'Gann', family: 'fib', iconKey: 'Square', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'gannSquare', label: 'Gann square', category: 'fib', subSection: 'Gann', family: 'fib', iconKey: 'Square', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: true }, optionsSchema: fibSchema }),
  def({ id: 'gannFan', label: 'Gann fan', category: 'fib', subSection: 'Gann', family: 'fib', iconKey: 'Fan', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true }, optionsSchema: fibSchema }),

  /* ── Patterns → CHART PATTERNS ──────────────────────────────── */
  def({ id: 'xabcd', label: 'XABCD pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', iconKey: 'GitMerge', capabilities: { anchors: 5, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'cypherPattern', label: 'Cypher pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', iconKey: 'GitMerge', capabilities: { anchors: 5, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'headAndShoulders', label: 'Head and shoulders', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', iconKey: 'Mountain', capabilities: { anchors: 5, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'abcdPattern', label: 'ABCD pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', iconKey: 'GitMerge', capabilities: { anchors: 4, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'trianglePattern', label: 'Triangle pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', iconKey: 'Play', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'threeDrives', label: 'Three drives pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', iconKey: 'Activity', capabilities: { anchors: 7, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  /* ── Patterns → ELLIOTT WAVES ───────────────────────────────── */
  def({ id: 'elliottImpulse', label: 'Elliott impulse wave (1-2-3-4-5)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', iconKey: 'Activity', capabilities: { anchors: 5, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'elliottCorrection', label: 'Elliott correction wave (A-B-C)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', iconKey: 'Activity', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'elliottTriangle', label: 'Elliott triangle wave (A-B-C-D-E)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', iconKey: 'Activity', capabilities: { anchors: 5, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'elliottDoubleCombo', label: 'Elliott double combo wave (W-X-Y)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', iconKey: 'Activity', capabilities: { anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'elliottTripleCombo', label: 'Elliott triple combo wave (W-X-Y-X-Z)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', iconKey: 'Activity', capabilities: { anchors: 5, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  /* ── Patterns → CYCLES ──────────────────────────────────────── */
  def({ id: 'cyclicLines', label: 'Cyclic lines', category: 'patterns', subSection: 'Cycles', family: 'pattern', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'timeCycles', label: 'Time cycles', category: 'patterns', subSection: 'Cycles', family: 'pattern', iconKey: 'Clock3', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'sineLine', label: 'Sine line', category: 'patterns', subSection: 'Cycles', family: 'pattern', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  /* ── Forecasting → FORECASTING ──────────────────────────────── */
  def({ id: 'longPosition', label: 'Long position', category: 'forecasting', subSection: 'Forecasting', family: 'position', iconKey: 'TrendingUp', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema }),
  def({ id: 'shortPosition', label: 'Short position', category: 'forecasting', subSection: 'Forecasting', family: 'position', iconKey: 'TrendingDown', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema }),
  def({ id: 'positionForecast', label: 'Position forecast', category: 'forecasting', subSection: 'Forecasting', family: 'position', iconKey: 'Activity', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema }),
  def({ id: 'barPattern', label: 'Bar pattern', category: 'forecasting', subSection: 'Forecasting', family: 'pattern', iconKey: 'Activity', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'ghostFeed', label: 'Ghost feed', category: 'forecasting', subSection: 'Forecasting', family: 'pattern', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'sector', label: 'Sector', category: 'forecasting', subSection: 'Forecasting', family: 'shape', iconKey: 'Mountain', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema }),

  /* ── Forecasting → VOLUME-BASED ─────────────────────────────── */
  def({ id: 'anchoredVwap', label: 'Anchored VWAP', category: 'forecasting', subSection: 'Volume-based', family: 'line', iconKey: 'Activity', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'fixedRangeVolumeProfile', label: 'Fixed range volume profile', category: 'forecasting', subSection: 'Volume-based', family: 'measure', iconKey: 'Activity', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema }),
  def({ id: 'anchoredVolumeProfile', label: 'Anchored volume profile', category: 'forecasting', subSection: 'Volume-based', family: 'measure', iconKey: 'Activity', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema }),

  /* ── Forecasting → MEASURERS ────────────────────────────────── */
  def({ id: 'priceRange', label: 'Price range', category: 'forecasting', subSection: 'Measurers', family: 'measure', iconKey: 'Ruler', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'dateRange', label: 'Date range', category: 'forecasting', subSection: 'Measurers', family: 'measure', iconKey: 'Ruler', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'dateAndPriceRange', label: 'Date and price range', category: 'forecasting', subSection: 'Measurers', family: 'measure', iconKey: 'Ruler', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  /* Legacy measure/zoom aliases */
  def({ id: 'measure', label: 'Measure', category: 'forecasting', subSection: 'Measurers', family: 'measure', iconKey: 'Ruler', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'zoom', label: 'Zoom', category: 'forecasting', subSection: 'Measurers', family: 'measure', iconKey: 'ZoomIn', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  /* ── Brush → BRUSHES ────────────────────────────────────────── */
  def({ id: 'brush', label: 'Brush', category: 'brush', subSection: 'Brushes', family: 'shape', iconKey: 'PencilLine', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: shapeSchema }),
  def({ id: 'highlighter', label: 'Highlighter', category: 'brush', subSection: 'Brushes', family: 'shape', iconKey: 'PencilLine', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: shapeSchema }),

  /* ── Brush → ARROWS ─────────────────────────────────────────── */
  def({ id: 'arrowMarker', label: 'Arrow marker', category: 'brush', subSection: 'Arrows', family: 'text', iconKey: 'ArrowUp', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'arrowTool', label: 'Arrow', category: 'brush', subSection: 'Arrows', family: 'line', iconKey: 'ArrowRight', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'arrowMarkUp', label: 'Arrow mark up', category: 'brush', subSection: 'Arrows', family: 'text', iconKey: 'ArrowUp', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'arrowMarkDown', label: 'Arrow mark down', category: 'brush', subSection: 'Arrows', family: 'text', iconKey: 'ArrowDown', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),

  /* ── Brush → SHAPES ─────────────────────────────────────────── */
  def({ id: 'rectangle', label: 'Rectangle', category: 'brush', subSection: 'Shapes', family: 'shape', iconKey: 'RectangleHorizontal', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema, behaviors: { shapeKind: 'rectangle' } }),
  def({ id: 'rotatedRectangle', label: 'Rotated rectangle', category: 'brush', subSection: 'Shapes', family: 'shape', iconKey: 'RectangleHorizontal', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema, behaviors: { shapeKind: 'rectangle' } }),
  def({ id: 'path', label: 'Path', category: 'brush', subSection: 'Shapes', family: 'line', iconKey: 'PencilLine', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'circle', label: 'Circle', category: 'brush', subSection: 'Shapes', family: 'shape', iconKey: 'Circle', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema, behaviors: { shapeKind: 'circle' } }),
  def({ id: 'ellipse', label: 'Ellipse', category: 'brush', subSection: 'Shapes', family: 'shape', iconKey: 'Circle', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema, behaviors: { shapeKind: 'circle' } }),
  def({ id: 'polyline', label: 'Polyline', category: 'brush', subSection: 'Shapes', family: 'line', iconKey: 'PencilLine', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'triangle', label: 'Triangle', category: 'brush', subSection: 'Shapes', family: 'shape', iconKey: 'Play', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: shapeSchema, behaviors: { shapeKind: 'triangle' } }),
  def({ id: 'arc', label: 'Arc', category: 'brush', subSection: 'Shapes', family: 'shape', iconKey: 'Circle', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: shapeSchema }),
  def({ id: 'curveTool', label: 'Curve', category: 'brush', subSection: 'Shapes', family: 'line', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),
  def({ id: 'doubleCurve', label: 'Double curve', category: 'brush', subSection: 'Shapes', family: 'line', iconKey: 'Waves', capabilities: { anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: lineSchema }),

  /* ── Text → TEXT AND NOTES ──────────────────────────────────── */
  def({ id: 'plainText', label: 'Text', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'Type', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'anchoredText', label: 'Anchored text', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'Type', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'note', label: 'Note', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'MessageSquare', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'priceNote', label: 'Price note', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'Tag', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'pin', label: 'Pin', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'Pin', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'table', label: 'Table', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'Square', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'callout', label: 'Callout', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'MessageCircle', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'comment', label: 'Comment', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'MessageSquareText', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'priceLabel', label: 'Price label', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'Tag', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'signpost', label: 'Signpost', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'Flag', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'flagMark', label: 'Flag mark', category: 'text', subSection: 'Text and Notes', family: 'text', iconKey: 'Flag', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),

  /* ── Text → CONTENT ─────────────────────────────────────────── */
  def({ id: 'image', label: 'Image', category: 'text', subSection: 'Content', family: 'text', iconKey: 'Square', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'post', label: 'Post', category: 'text', subSection: 'Content', family: 'text', iconKey: 'MessageSquare', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'idea', label: 'Idea', category: 'text', subSection: 'Content', family: 'text', iconKey: 'Sparkles', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: true, supportsLevels: false }, optionsSchema: textSchema }),

  /* ── Icon ────────────────────────────────────────────────────── */
  def({ id: 'emoji', label: 'Emojis', category: 'icon', subSection: 'Emojis', family: 'text', iconKey: 'Sparkles', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'sticker', label: 'Stickers', category: 'icon', subSection: 'Stickers', family: 'text', iconKey: 'Sparkles', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
  def({ id: 'iconTool', label: 'Icons', category: 'icon', subSection: 'Icons', family: 'text', iconKey: 'Sparkles', capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }, optionsSchema: textSchema }),
];

export const toolDefinitionMap = new Map(toolDefinitions.map((tool) => [tool.id, tool]));

export function getToolDefinition(id: ToolVariant): ToolDefinition | null {
  return toolDefinitionMap.get(id) || null;
}

const categoryMeta: Array<{ id: ToolCategory; label: string; railIcon: string }> = [
  { id: 'cursor', label: 'Cursor', railIcon: 'Crosshair' },
  { id: 'lines', label: 'Lines', railIcon: 'TrendingUp' },
  { id: 'fib', label: 'Fibonacci', railIcon: 'Waves' },
  { id: 'patterns', label: 'Patterns', railIcon: 'GitMerge' },
  { id: 'forecasting', label: 'Forecasting', railIcon: 'TrendingUp' },
  { id: 'brush', label: 'Brush', railIcon: 'PencilLine' },
  { id: 'text', label: 'Text', railIcon: 'Type' },
  { id: 'icon', label: 'Icons', railIcon: 'Sparkles' },
];

export type ToolGroupVariant = { id: ToolVariant; label: string; iconKey: string; implemented: boolean; subSection?: string };
export type ToolGroup = { id: ToolCategory; label: string; railIcon: string; variants: ToolGroupVariant[] };

/** Legacy tool variants that should not appear in category menus. */
const hiddenFromMenus: ReadonlySet<ToolVariant> = new Set(['measure', 'zoom']);

export const toolGroups: ToolGroup[] = categoryMeta
  .map((meta) => {
    const items = toolDefinitions.filter((tool) => tool.category === meta.id && !hiddenFromMenus.has(tool.id));
    if (!items.length && meta.id !== 'cursor') return null;
    return {
      id: meta.id,
      label: meta.label,
      railIcon: meta.railIcon,
      variants: items.map((tool) => ({ id: tool.id, label: tool.label, iconKey: tool.iconKey, implemented: tool.implemented, subSection: tool.subSection })),
    };
  })
  .filter(Boolean) as ToolGroup[];

export const toolCursor: Record<ToolVariant, string> = toolDefinitions.reduce(
  (acc, tool) => ({ ...acc, [tool.id]: tool.family === 'text' ? 'text' : tool.id === 'zoom' ? 'zoom-in' : 'crosshair' }),
  { none: 'default' } as Record<ToolVariant, string>
);

export function buildToolOptions(variant: Exclude<ToolVariant, 'none'>): ToolOptions {
  const definition = getToolDefinition(variant);
  return mergeToolOptions(defaultToolOptions, definition?.defaultOptions || {});
}
