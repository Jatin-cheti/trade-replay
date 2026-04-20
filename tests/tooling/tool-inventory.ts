/**
 * Tool Inventory — Phase 1 Source of Truth
 *
 * Enumerates ALL tools from:
 *   - Left toolbar  (every drawing tool + cursor modes)
 *   - Header toolbar (chart types, indicators, snap mode)
 *
 * Derived programmatically from:
 *   frontend/services/tools/toolRegistry.ts
 *   frontend/services/tools/toolOptions.ts
 *   frontend/services/chart/dataTransforms.ts
 *   packages/tradereplay-charts/src/indicators/builtins/index.ts
 *
 * Run `node tests/tooling/generate-inventory.mjs` to emit artifacts/tool-inventory.json
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OptionValueEntry = { label: string; value: string | number | boolean };

export type InventoryOption = {
  optionId: string;
  optionName: string;
  type: 'color' | 'range' | 'select' | 'toggle' | 'text' | 'number';
  values: OptionValueEntry[];
  defaultValue: string | number | boolean;
  visibilityConditions?: string;
};

export type DrawingToolItem = {
  toolId: string;
  toolName: string;
  toolbar: 'left';
  category: string;
  subSection?: string;
  family: string;
  /** data-testid on the button in the tool-rail popover */
  testId: string;
  /** data-testid on the rail category button */
  railGroup: string;
  anchorCount: number;
  /** true when anchors <= 1 (single-click placement) */
  pointOnly: boolean;
  /** true when pattern family with > 2 anchors (wizard placement) */
  isWizard: boolean;
  options: InventoryOption[];
};

export type HeaderToolItem = {
  toolId: string;
  toolName: string;
  toolbar: 'header';
  category: 'chartType' | 'indicator' | 'snapMode';
  testId: string;
  /** For chart type: data-testid or dropdown value */
  selectorType: 'button' | 'dropdown-option';
  options: InventoryOption[];
};

export type CursorModeItem = {
  toolId: string;
  toolName: string;
  toolbar: 'left';
  category: 'cursor';
  testId: string;
};

export type ToolInventory = {
  generatedAt: string;
  totals: {
    leftToolbarDrawingTools: number;
    cursorModes: number;
    headerChartTypes: number;
    headerIndicators: number;
    headerSnapModes: number;
    totalTools: number;
    totalOptionValueCombinations: number;
  };
  leftToolbar: DrawingToolItem[];
  cursorModes: CursorModeItem[];
  headerToolbar: HeaderToolItem[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Option schemas (mirrors toolOptions.ts baseOptionSchema filtering)
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_VALUES: OptionValueEntry[] = [
  { label: 'Cyan', value: '#00d1ff' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'White', value: '#ffffff' },
];

const THICKNESS_VALUES: OptionValueEntry[] = [
  { label: '1px', value: 1 },
  { label: '2px', value: 2 },
  { label: '4px', value: 4 },
  { label: '8px', value: 8 },
];

const STYLE_VALUES: OptionValueEntry[] = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
];

const OPACITY_VALUES: OptionValueEntry[] = [
  { label: '15%', value: 0.15 },
  { label: '50%', value: 0.5 },
  { label: '95%', value: 0.95 },
  { label: '100%', value: 1 },
];

const BOOL_VALUES: OptionValueEntry[] = [
  { label: 'On', value: true },
  { label: 'Off', value: false },
];

const SNAP_VALUES: OptionValueEntry[] = [
  { label: 'Off', value: 'off' },
  { label: 'OHLC', value: 'ohlc' },
  { label: 'Nearest Candle', value: 'candle' },
];

const FIB_LABEL_VALUES: OptionValueEntry[] = [
  { label: 'Percent', value: 'percent' },
  { label: 'Price', value: 'price' },
  { label: 'Both', value: 'both' },
];

const VWAP_INTERVAL_VALUES: OptionValueEntry[] = [
  { label: 'Session', value: 'session' },
  { label: 'Weekly', value: 'week' },
  { label: 'Monthly', value: 'month' },
];

const POSITION_LABEL_VALUES: OptionValueEntry[] = [
  { label: 'Risk/Reward', value: 'rr' },
  { label: 'Price Delta', value: 'price' },
  { label: 'Both', value: 'both' },
];

const FONT_VALUES: OptionValueEntry[] = [
  { label: 'JetBrains Mono', value: 'JetBrains Mono' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'IBM Plex Sans', value: 'IBM Plex Sans' },
  { label: 'Space Grotesk', value: 'Space Grotesk' },
];

const TEXT_SIZE_VALUES: OptionValueEntry[] = [
  { label: '10', value: 10 },
  { label: '12', value: 12 },
  { label: '18', value: 18 },
  { label: '28', value: 28 },
];

const TEXT_ALIGN_VALUES: OptionValueEntry[] = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];

const BRUSH_SMOOTHNESS_VALUES: OptionValueEntry[] = [
  { label: '0 (sharp)', value: 0 },
  { label: '0.45 (default)', value: 0.45 },
  { label: '1 (smooth)', value: 1 },
];

// Shared option sets keyed by schema name
const baseOptions: InventoryOption[] = [
  { optionId: 'color', optionName: 'Stroke Color', type: 'color', values: COLOR_VALUES, defaultValue: '#00d1ff' },
  { optionId: 'opacity', optionName: 'Opacity', type: 'range', values: OPACITY_VALUES, defaultValue: 0.95 },
  { optionId: 'thickness', optionName: 'Line Width', type: 'range', values: THICKNESS_VALUES, defaultValue: 2 },
  { optionId: 'style', optionName: 'Line Style', type: 'select', values: STYLE_VALUES, defaultValue: 'solid' },
  { optionId: 'extendLeft', optionName: 'Extend Left', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
  { optionId: 'extendRight', optionName: 'Extend Right', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
  { optionId: 'rayMode', optionName: 'Ray Mode', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
  { optionId: 'snapMode', optionName: 'Snap Mode', type: 'select', values: SNAP_VALUES, defaultValue: 'off' },
  { optionId: 'priceLabel', optionName: 'Price Label', type: 'toggle', values: BOOL_VALUES, defaultValue: true },
  { optionId: 'axisLabel', optionName: 'Axis Label', type: 'toggle', values: BOOL_VALUES, defaultValue: true },
  { optionId: 'locked', optionName: 'Lock', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
  { optionId: 'visible', optionName: 'Visible', type: 'toggle', values: BOOL_VALUES, defaultValue: true },
];

const lineOptions = baseOptions.filter((o) =>
  !['font', 'bold', 'italic', 'align', 'textBackground', 'textBorder', 'textPadding', 'fibLevels', 'fibLabelMode', 'vwapInterval', 'positionLabelMode', 'brushSmoothness'].includes(o.optionId)
);

const textOptions: InventoryOption[] = [
  ...baseOptions.filter((o) => !['extendLeft', 'extendRight', 'rayMode', 'fibLevels', 'fibLabelMode', 'vwapInterval', 'positionLabelMode', 'brushSmoothness'].includes(o.optionId)),
  { optionId: 'font', optionName: 'Font', type: 'select', values: FONT_VALUES, defaultValue: 'JetBrains Mono' },
  { optionId: 'textSize', optionName: 'Font Size', type: 'range', values: TEXT_SIZE_VALUES, defaultValue: 12 },
  { optionId: 'bold', optionName: 'Bold', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
  { optionId: 'italic', optionName: 'Italic', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
  { optionId: 'align', optionName: 'Text Align', type: 'select', values: TEXT_ALIGN_VALUES, defaultValue: 'left' },
  { optionId: 'textBackground', optionName: 'Text Background', type: 'toggle', values: BOOL_VALUES, defaultValue: true },
  { optionId: 'textBorder', optionName: 'Text Border', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
];

const shapeOptions = baseOptions.filter((o) =>
  !['rayMode', 'fibLevels', 'fibLabelMode', 'vwapInterval', 'brushSmoothness'].includes(o.optionId)
);

const brushOptions: InventoryOption[] = [
  ...baseOptions.filter((o) =>
    !['extendLeft', 'extendRight', 'rayMode', 'fibLevels', 'fibLabelMode', 'vwapInterval', 'positionLabelMode', 'font', 'bold', 'italic', 'align', 'textBackground', 'textBorder', 'textPadding'].includes(o.optionId)
  ),
  { optionId: 'brushSmoothness', optionName: 'Brush Smoothness', type: 'range', values: BRUSH_SMOOTHNESS_VALUES, defaultValue: 0.45 },
];

const fibOptions: InventoryOption[] = [
  ...baseOptions.filter((o) => !['vwapInterval', 'positionLabelMode', 'brushSmoothness'].includes(o.optionId)),
  { optionId: 'fibLevels', optionName: 'Fib Levels (CSV)', type: 'text', values: [
    { label: 'Default', value: '' },
    { label: 'Custom 3', value: '0,0.5,1' },
  ], defaultValue: '' },
  { optionId: 'fibLabelMode', optionName: 'Fib Label Mode', type: 'select', values: FIB_LABEL_VALUES, defaultValue: 'percent' },
];

const forecastingOptions: InventoryOption[] = [
  ...baseOptions.filter((o) => !['fibLevels', 'fibLabelMode', 'brushSmoothness'].includes(o.optionId)),
  { optionId: 'vwapInterval', optionName: 'VWAP Interval', type: 'select', values: VWAP_INTERVAL_VALUES, defaultValue: 'session', visibilityConditions: 'anchoredVwap only' },
  { optionId: 'positionLabelMode', optionName: 'Position Label', type: 'select', values: POSITION_LABEL_VALUES, defaultValue: 'rr', visibilityConditions: 'position tools only' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Test ID mapping (mirrors ToolRail.tsx requiredTestIdByVariant)
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_TEST_IDS: Record<string, string> = {
  trend: 'tool-trendline',
  ray: 'tool-ray',
  infoLine: 'tool-info-line',
  extendedLine: 'tool-extended-line',
  trendAngle: 'tool-trend-angle',
  hline: 'tool-horizontal-line',
  horizontalRay: 'tool-horizontal-ray',
  vline: 'tool-vertical-line',
  crossLine: 'tool-cross-line',
  channel: 'tool-parallel-channel',
  regressionTrend: 'tool-regression-trend',
  flatTopBottom: 'tool-flat-top-bottom',
  disjointChannel: 'tool-disjoint-channel',
  pitchfork: 'tool-pitchfork',
  schiffPitchfork: 'tool-schiff-pitchfork',
  modifiedSchiffPitchfork: 'tool-modified-schiff-pitchfork',
  insidePitchfork: 'tool-inside-pitchfork',
  fibRetracement: 'fib-retracement',
  fibExtension: 'fib-extension',
  fibChannel: 'fib-channel',
  fibTimeZone: 'fib-time-zone',
  fibSpeedResistFan: 'fib-speed-resistance-fan',
  fibTrendTime: 'fib-trend-time',
  fibCircles: 'fib-circles',
  fibSpiral: 'fib-spiral',
  fibSpeedResistArcs: 'fib-speed-resistance-arcs',
  fibWedge: 'fib-wedge',
  pitchfan: 'pitchfan',
  gannBox: 'gann-box',
  gannSquareFixed: 'gann-square-fixed',
  gannSquare: 'gann-square',
  gannFan: 'gann-fan',
};

function getTestId(variantId: string): string {
  return REQUIRED_TEST_IDS[variantId] ?? `tool-${variantId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Left Toolbar Drawing Tools
// ─────────────────────────────────────────────────────────────────────────────

type RawToolDef = {
  id: string;
  label: string;
  category: string;
  subSection?: string;
  family: string;
  anchors: number;
  options: InventoryOption[];
};

const rawTools: RawToolDef[] = [
  // ── Lines → Lines ────────────────────────────────────────────────────────
  { id: 'trend', label: 'Trend line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, options: lineOptions },
  { id: 'ray', label: 'Ray', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, options: lineOptions },
  { id: 'infoLine', label: 'Info line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, options: lineOptions },
  { id: 'extendedLine', label: 'Extended line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, options: lineOptions },
  { id: 'trendAngle', label: 'Trend angle', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, options: lineOptions },
  { id: 'hline', label: 'Horizontal line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, options: lineOptions },
  { id: 'horizontalRay', label: 'Horizontal ray', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, options: lineOptions },
  { id: 'vline', label: 'Vertical line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, options: lineOptions },
  { id: 'crossLine', label: 'Cross line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, options: lineOptions },

  // ── Lines → Channels ─────────────────────────────────────────────────────
  { id: 'channel', label: 'Parallel channel', category: 'lines', subSection: 'Channels', family: 'line', anchors: 2, options: lineOptions },
  { id: 'regressionTrend', label: 'Regression trend', category: 'lines', subSection: 'Channels', family: 'line', anchors: 2, options: lineOptions },
  { id: 'flatTopBottom', label: 'Flat top/bottom', category: 'lines', subSection: 'Channels', family: 'line', anchors: 2, options: lineOptions },
  { id: 'disjointChannel', label: 'Disjoint channel', category: 'lines', subSection: 'Channels', family: 'line', anchors: 4, options: lineOptions },

  // ── Lines → Pitchforks ───────────────────────────────────────────────────
  { id: 'pitchfork', label: 'Pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, options: fibOptions },
  { id: 'schiffPitchfork', label: 'Schiff pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, options: fibOptions },
  { id: 'modifiedSchiffPitchfork', label: 'Modified Schiff pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, options: fibOptions },
  { id: 'insidePitchfork', label: 'Inside pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, options: fibOptions },

  // ── Fibonacci ─────────────────────────────────────────────────────────────
  { id: 'fibRetracement', label: 'Fib retracement', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'fibExtension', label: 'Trend-based fib extension', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'fibChannel', label: 'Fib channel', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'fibTimeZone', label: 'Fib time zone', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'fibSpeedResistFan', label: 'Fib speed resistance fan', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'fibTrendTime', label: 'Trend-based fib time', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'fibCircles', label: 'Fib circles', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'fibSpiral', label: 'Fib spiral', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'fibSpeedResistArcs', label: 'Fib speed resistance arcs', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'fibWedge', label: 'Fib wedge', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'pitchfan', label: 'Pitchfan', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 3, options: fibOptions },

  // ── Gann ──────────────────────────────────────────────────────────────────
  { id: 'gannBox', label: 'Gann box', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'gannSquareFixed', label: 'Gann square fixed', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'gannSquare', label: 'Gann square', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, options: fibOptions },
  { id: 'gannFan', label: 'Gann fan', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, options: fibOptions },

  // ── Patterns → Chart Patterns ─────────────────────────────────────────────
  { id: 'xabcd', label: 'XABCD pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 5, options: lineOptions },
  { id: 'cypherPattern', label: 'Cypher pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 5, options: lineOptions },
  { id: 'headAndShoulders', label: 'Head and shoulders', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 5, options: lineOptions },
  { id: 'abcdPattern', label: 'ABCD pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 4, options: lineOptions },
  { id: 'trianglePattern', label: 'Triangle pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 3, options: lineOptions },
  { id: 'threeDrives', label: 'Three drives pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 7, options: lineOptions },

  // ── Patterns → Elliott Waves ──────────────────────────────────────────────
  { id: 'elliottImpulse', label: 'Elliott impulse wave (1-2-3-4-5)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 5, options: lineOptions },
  { id: 'elliottCorrection', label: 'Elliott correction wave (A-B-C)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 3, options: lineOptions },
  { id: 'elliottTriangle', label: 'Elliott triangle wave (A-B-C-D-E)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 5, options: lineOptions },
  { id: 'elliottDoubleCombo', label: 'Elliott double combo wave (W-X-Y)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 3, options: lineOptions },
  { id: 'elliottTripleCombo', label: 'Elliott triple combo wave (W-X-Y-X-Z)', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 5, options: lineOptions },

  // ── Patterns → Cycles ─────────────────────────────────────────────────────
  { id: 'cyclicLines', label: 'Cyclic lines', category: 'patterns', subSection: 'Cycles', family: 'pattern', anchors: 2, options: lineOptions },
  { id: 'timeCycles', label: 'Time cycles', category: 'patterns', subSection: 'Cycles', family: 'pattern', anchors: 2, options: lineOptions },
  { id: 'sineLine', label: 'Sine line', category: 'patterns', subSection: 'Cycles', family: 'pattern', anchors: 2, options: lineOptions },

  // ── Forecasting → Forecasting ─────────────────────────────────────────────
  { id: 'longPosition', label: 'Long position', category: 'forecasting', subSection: 'Forecasting', family: 'position', anchors: 3, options: forecastingOptions },
  { id: 'shortPosition', label: 'Short position', category: 'forecasting', subSection: 'Forecasting', family: 'position', anchors: 3, options: forecastingOptions },
  { id: 'positionForecast', label: 'Position forecast', category: 'forecasting', subSection: 'Forecasting', family: 'position', anchors: 3, options: forecastingOptions },
  { id: 'barPattern', label: 'Bar pattern', category: 'forecasting', subSection: 'Forecasting', family: 'pattern', anchors: 2, options: forecastingOptions },
  { id: 'ghostFeed', label: 'Ghost feed', category: 'forecasting', subSection: 'Forecasting', family: 'pattern', anchors: 2, options: forecastingOptions },
  { id: 'sector', label: 'Sector', category: 'forecasting', subSection: 'Forecasting', family: 'shape', anchors: 2, options: forecastingOptions },

  // ── Forecasting → Volume-based ────────────────────────────────────────────
  { id: 'anchoredVwap', label: 'Anchored VWAP', category: 'forecasting', subSection: 'Volume-based', family: 'line', anchors: 1, options: forecastingOptions },
  { id: 'fixedRangeVolumeProfile', label: 'Fixed range volume profile', category: 'forecasting', subSection: 'Volume-based', family: 'measure', anchors: 2, options: forecastingOptions },
  { id: 'anchoredVolumeProfile', label: 'Anchored volume profile', category: 'forecasting', subSection: 'Volume-based', family: 'measure', anchors: 1, options: forecastingOptions },

  // ── Forecasting → Measurers ───────────────────────────────────────────────
  { id: 'priceRange', label: 'Price range', category: 'forecasting', subSection: 'Measurers', family: 'measure', anchors: 2, options: forecastingOptions },
  { id: 'dateRange', label: 'Date range', category: 'forecasting', subSection: 'Measurers', family: 'measure', anchors: 2, options: forecastingOptions },
  { id: 'dateAndPriceRange', label: 'Date and price range', category: 'forecasting', subSection: 'Measurers', family: 'measure', anchors: 2, options: forecastingOptions },

  // ── Brush → Brushes ───────────────────────────────────────────────────────
  { id: 'brush', label: 'Brush', category: 'brush', subSection: 'Brushes', family: 'shape', anchors: 2, options: brushOptions },
  { id: 'highlighter', label: 'Highlighter', category: 'brush', subSection: 'Brushes', family: 'shape', anchors: 2, options: brushOptions },

  // ── Brush → Arrows ────────────────────────────────────────────────────────
  { id: 'arrowMarker', label: 'Arrow marker', category: 'brush', subSection: 'Arrows', family: 'text', anchors: 1, options: textOptions },
  { id: 'arrowTool', label: 'Arrow', category: 'brush', subSection: 'Arrows', family: 'line', anchors: 2, options: lineOptions },
  { id: 'arrowMarkUp', label: 'Arrow mark up', category: 'brush', subSection: 'Arrows', family: 'text', anchors: 1, options: textOptions },
  { id: 'arrowMarkDown', label: 'Arrow mark down', category: 'brush', subSection: 'Arrows', family: 'text', anchors: 1, options: textOptions },

  // ── Brush → Shapes ────────────────────────────────────────────────────────
  { id: 'rectangle', label: 'Rectangle', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, options: shapeOptions },
  { id: 'rotatedRectangle', label: 'Rotated rectangle', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, options: shapeOptions },
  { id: 'path', label: 'Path', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, options: brushOptions },
  { id: 'circle', label: 'Circle', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, options: shapeOptions },
  { id: 'ellipse', label: 'Ellipse', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, options: shapeOptions },
  { id: 'polyline', label: 'Polyline', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, options: brushOptions },
  { id: 'triangle', label: 'Triangle', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, options: shapeOptions },
  { id: 'arc', label: 'Arc', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, options: shapeOptions },
  { id: 'curveTool', label: 'Curve', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, options: brushOptions },
  { id: 'doubleCurve', label: 'Double curve', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, options: brushOptions },

  // ── Text → Text and Notes ─────────────────────────────────────────────────
  { id: 'plainText', label: 'Text', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'anchoredText', label: 'Anchored text', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'note', label: 'Note', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'priceNote', label: 'Price note', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'pin', label: 'Pin', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'table', label: 'Table', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'callout', label: 'Callout', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'comment', label: 'Comment', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'priceLabel', label: 'Price label', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'signpost', label: 'Signpost', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },
  { id: 'flagMark', label: 'Flag mark', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, options: textOptions },

  // ── Text → Content ────────────────────────────────────────────────────────
  { id: 'image', label: 'Image', category: 'text', subSection: 'Content', family: 'text', anchors: 1, options: textOptions },
  { id: 'post', label: 'Post', category: 'text', subSection: 'Content', family: 'text', anchors: 1, options: textOptions },
  { id: 'idea', label: 'Idea', category: 'text', subSection: 'Content', family: 'text', anchors: 1, options: textOptions },

  // ── Icons ─────────────────────────────────────────────────────────────────
  { id: 'emoji', label: 'Emojis', category: 'icon', subSection: 'Emojis', family: 'text', anchors: 1, options: textOptions },
  { id: 'sticker', label: 'Stickers', category: 'icon', subSection: 'Stickers', family: 'text', anchors: 1, options: textOptions },
  { id: 'iconTool', label: 'Icons', category: 'icon', subSection: 'Icons', family: 'text', anchors: 1, options: textOptions },
];

export const leftToolbarItems: DrawingToolItem[] = rawTools.map((t) => ({
  toolId: t.id,
  toolName: t.label,
  toolbar: 'left',
  category: t.category,
  subSection: t.subSection,
  family: t.family,
  testId: getTestId(t.id),
  railGroup: t.category,
  anchorCount: t.anchors,
  pointOnly: t.anchors <= 1,
  isWizard: t.family === 'pattern' && t.anchors > 2,
  options: t.options,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Cursor Modes
// ─────────────────────────────────────────────────────────────────────────────

export const cursorModeItems: CursorModeItem[] = [
  { toolId: 'cross', toolName: 'Cross', toolbar: 'left', category: 'cursor', testId: 'cursor-cross' },
  { toolId: 'dot', toolName: 'Dot', toolbar: 'left', category: 'cursor', testId: 'cursor-dot' },
  { toolId: 'arrow', toolName: 'Arrow', toolbar: 'left', category: 'cursor', testId: 'cursor-arrow' },
  { toolId: 'eraser', toolName: 'Eraser', toolbar: 'left', category: 'cursor', testId: 'cursor-eraser' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Header Toolbar — Chart Types
// ─────────────────────────────────────────────────────────────────────────────

const CHART_TYPES: Array<{ id: string; label: string; testId: string; selectorType: 'button' | 'dropdown-option' }> = [
  // Quick buttons
  { id: 'candlestick', label: 'Candlestick', testId: 'chart-type-candlestick', selectorType: 'button' },
  { id: 'line', label: 'Line', testId: 'chart-type-line', selectorType: 'button' },
  { id: 'area', label: 'Area', testId: 'chart-type-area', selectorType: 'button' },
  // Dropdown "More charts..."
  { id: 'baseline', label: 'Baseline', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'histogram', label: 'Histogram', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'bar', label: 'Bar', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'ohlc', label: 'OHLC', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'heikinAshi', label: 'Heikin Ashi', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'hollowCandles', label: 'Hollow Candles', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'stepLine', label: 'Step Line', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'rangeArea', label: 'Range Area', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'mountainArea', label: 'Mountain Area', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'renko', label: 'Renko', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'rangeBars', label: 'Range Bars', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'lineBreak', label: '3-Line Break', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'kagi', label: 'Kagi', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'pointFigure', label: 'Point & Figure', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'brick', label: 'Brick', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'volumeCandles', label: 'Candles + Volume', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
  { id: 'volumeLine', label: 'Line + Volume', testId: 'chart-type-dropdown', selectorType: 'dropdown-option' },
];

export const headerChartTypeItems: HeaderToolItem[] = CHART_TYPES.map((ct) => ({
  toolId: ct.id,
  toolName: ct.label,
  toolbar: 'header',
  category: 'chartType',
  testId: ct.testId,
  selectorType: ct.selectorType,
  options: [],
}));

// ─────────────────────────────────────────────────────────────────────────────
// Header Toolbar — Crosshair Snap Modes
// ─────────────────────────────────────────────────────────────────────────────

export const headerSnapModeItems: HeaderToolItem[] = [
  { toolId: 'snap-free', toolName: 'Snap: Free', toolbar: 'header', category: 'snapMode', testId: 'chart-snap-mode', selectorType: 'dropdown-option', options: [] },
  { toolId: 'snap-time', toolName: 'Snap: Time', toolbar: 'header', category: 'snapMode', testId: 'chart-snap-mode', selectorType: 'dropdown-option', options: [] },
  { toolId: 'snap-ohlc', toolName: 'Snap: OHLC', toolbar: 'header', category: 'snapMode', testId: 'chart-snap-mode', selectorType: 'dropdown-option', options: [] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Header Toolbar — Indicators
// All 200+ indicators registered in the system
// ─────────────────────────────────────────────────────────────────────────────

const INDICATOR_CATALOG: Array<{ id: string; label: string; category: string }> = [
  // Moving Averages
  { id: 'sma', label: 'Simple Moving Average (SMA)', category: 'Moving Averages' },
  { id: 'ema', label: 'Exponential Moving Average (EMA)', category: 'Moving Averages' },
  { id: 'wma', label: 'Weighted Moving Average (WMA)', category: 'Moving Averages' },
  { id: 'hma', label: 'Hull Moving Average (HMA)', category: 'Moving Averages' },
  { id: 'dema', label: 'Double EMA (DEMA)', category: 'Moving Averages' },
  { id: 'tema', label: 'Triple EMA (TEMA)', category: 'Moving Averages' },
  { id: 'zlema', label: 'Zero Lag EMA (ZLEMA)', category: 'Moving Averages' },
  { id: 'kama', label: 'KAMA', category: 'Moving Averages' },
  { id: 'alma', label: 'Arnaud Legoux MA (ALMA)', category: 'Moving Averages' },
  { id: 'lsma', label: 'Least Squares MA (LSMA)', category: 'Moving Averages' },
  { id: 'trima', label: 'Triangular MA (TRIMA)', category: 'Moving Averages' },
  { id: 'smma', label: 'Smoothed MA (SMMA)', category: 'Moving Averages' },
  { id: 'mcginley_dynamic', label: 'McGinley Dynamic', category: 'Moving Averages' },
  { id: 'vwma', label: 'VWMA', category: 'Moving Averages' },
  { id: 'ma_cross', label: 'MA Cross', category: 'Moving Averages' },
  { id: 'ma_ribbon', label: 'MA Ribbon', category: 'Moving Averages' },
  { id: 'multi_time_period', label: 'Multi-Period MA', category: 'Moving Averages' },
  // Volatility
  { id: 'bbands', label: 'Bollinger Bands (BB)', category: 'Volatility' },
  { id: 'keltner', label: 'Keltner Channels', category: 'Volatility' },
  { id: 'donchian', label: 'Donchian Channels', category: 'Volatility' },
  { id: 'atr', label: 'Average True Range (ATR)', category: 'Volatility' },
  { id: 'supertrend', label: 'Supertrend', category: 'Volatility' },
  { id: 'psar', label: 'Parabolic SAR', category: 'Volatility' },
  { id: 'chaikin_volatility', label: 'Chaikin Volatility', category: 'Volatility' },
  { id: 'bollinger_percent_b', label: 'Bollinger %B', category: 'Volatility' },
  { id: 'bollinger_bandwidth', label: 'Bollinger Bandwidth', category: 'Volatility' },
  { id: 'stddev', label: 'Standard Deviation', category: 'Volatility' },
  { id: 'variance', label: 'Variance', category: 'Volatility' },
  { id: 'normalized_atr', label: 'Normalized ATR', category: 'Volatility' },
  { id: 'ulcer_index', label: 'Ulcer Index', category: 'Volatility' },
  { id: 'volatility_ratio', label: 'Volatility Ratio', category: 'Volatility' },
  { id: 'volatility_ema', label: 'Volatility EMA', category: 'Volatility' },
  { id: 'bb_trend', label: 'BB Trend', category: 'Volatility' },
  { id: 'bollinger_bars', label: 'Bollinger Bars', category: 'Volatility' },
  { id: 'chande_kroll_stop', label: 'Chande Kroll Stop', category: 'Volatility' },
  { id: 'chandelier_exit', label: 'Chandelier Exit', category: 'Volatility' },
  { id: 'volatility_stop', label: 'Volatility Stop', category: 'Volatility' },
  // Oscillators / Momentum
  { id: 'rsi', label: 'RSI', category: 'Oscillators' },
  { id: 'macd', label: 'MACD', category: 'Oscillators' },
  { id: 'stochastic', label: 'Stochastic', category: 'Oscillators' },
  { id: 'cci', label: 'CCI', category: 'Oscillators' },
  { id: 'roc', label: 'Rate of Change (ROC)', category: 'Oscillators' },
  { id: 'momentum', label: 'Momentum', category: 'Oscillators' },
  { id: 'williams_r', label: "Williams %R", category: 'Oscillators' },
  { id: 'trix', label: 'TRIX', category: 'Oscillators' },
  { id: 'ultimate', label: 'Ultimate Oscillator', category: 'Oscillators' },
  { id: 'awesome', label: 'Awesome Oscillator', category: 'Oscillators' },
  { id: 'dpo', label: 'Detrended Price Osc (DPO)', category: 'Oscillators' },
  { id: 'stoch_rsi', label: 'Stochastic RSI', category: 'Oscillators' },
  { id: 'rvi', label: 'Relative Vigor Index (RVI)', category: 'Oscillators' },
  { id: 'ppo', label: 'PPO', category: 'Oscillators' },
  { id: 'tsi', label: 'True Strength Index (TSI)', category: 'Oscillators' },
  { id: 'crsi', label: 'Connors RSI (CRSI)', category: 'Oscillators' },
  { id: 'cmo', label: 'Chande Momentum Osc (CMO)', category: 'Oscillators' },
  { id: 'fisher', label: 'Fisher Transform', category: 'Oscillators' },
  { id: 'kdj', label: 'KDJ', category: 'Oscillators' },
  { id: 'apo', label: 'APO', category: 'Oscillators' },
  { id: 'smi', label: 'SMI', category: 'Oscillators' },
  { id: 'choppiness', label: 'Choppiness Index', category: 'Oscillators' },
  { id: 'mass_index', label: 'Mass Index', category: 'Oscillators' },
  { id: 'qstick', label: 'Qstick', category: 'Oscillators' },
  { id: 'balance_of_power', label: 'Balance of Power', category: 'Oscillators' },
  { id: 'coppock_curve', label: 'Coppock Curve', category: 'Oscillators' },
  { id: 'rsi_divergence', label: 'RSI Divergence', category: 'Oscillators' },
  { id: 'smi_ergodic', label: 'SMI Ergodic', category: 'Oscillators' },
  { id: 'smi_ergodic_osc', label: 'SMI Ergodic Oscillator', category: 'Oscillators' },
  { id: 'woodie_cci', label: "Woodie's CCI", category: 'Oscillators' },
  { id: 'price_momentum_osc', label: 'Price Momentum Oscillator', category: 'Oscillators' },
  { id: 'prings_special_k', label: "Pring's Special K", category: 'Oscillators' },
  { id: 'know_sure_thing', label: 'Know Sure Thing (KST)', category: 'Oscillators' },
  // Trend
  { id: 'adx', label: 'ADX', category: 'Trend' },
  { id: 'aroon', label: 'Aroon', category: 'Trend' },
  { id: 'aroon_oscillator', label: 'Aroon Oscillator', category: 'Trend' },
  { id: 'dx', label: 'DX', category: 'Trend' },
  { id: 'elder_ray', label: 'Elder Ray Index', category: 'Trend' },
  { id: 'vortex', label: 'Vortex Indicator', category: 'Trend' },
  { id: 'breakout_strength', label: 'Breakout Strength', category: 'Trend' },
  { id: 'trend_strength', label: 'Trend Strength', category: 'Trend' },
  { id: 'linear_reg_channel', label: 'Linear Regression Channel', category: 'Trend' },
  { id: 'linear_reg_slope', label: 'Linear Regression Slope', category: 'Trend' },
  { id: 'linear_reg_intercept', label: 'Linear Regression Intercept', category: 'Trend' },
  { id: 'linear_reg_angle', label: 'Linear Regression Angle', category: 'Trend' },
  { id: 'zigzag', label: 'Zig Zag', category: 'Trend' },
  { id: 'auto_trendlines', label: 'Auto Trendlines', category: 'Trend' },
  { id: 'auto_pitchfork', label: 'Auto Pitchfork', category: 'Trend' },
  { id: 'rank_correlation', label: 'Rank Correlation Index', category: 'Trend' },
  { id: 'rci_ribbon', label: 'RCI Ribbon', category: 'Trend' },
  { id: 'relative_volatility_index', label: 'Relative Volatility Index', category: 'Trend' },
  // Volume
  { id: 'obv', label: 'On-Balance Volume (OBV)', category: 'Volume' },
  { id: 'mfi', label: 'Money Flow Index (MFI)', category: 'Volume' },
  { id: 'cmf', label: 'Chaikin Money Flow (CMF)', category: 'Volume' },
  { id: 'vwap', label: 'VWAP', category: 'Volume' },
  { id: 'adl', label: 'Accumulation/Distribution', category: 'Volume' },
  { id: 'force_index', label: 'Force Index', category: 'Volume' },
  { id: 'eom', label: 'Ease of Movement (EOM)', category: 'Volume' },
  { id: 'nvi', label: 'Negative Volume Index (NVI)', category: 'Volume' },
  { id: 'pvi', label: 'Positive Volume Index (PVI)', category: 'Volume' },
  { id: 'vpt', label: 'Volume Price Trend (VPT)', category: 'Volume' },
  { id: 'chaikin_osc', label: 'Chaikin Oscillator', category: 'Volume' },
  { id: 'pvO', label: 'PVO', category: 'Volume' },
  { id: 'volume', label: 'Volume', category: 'Volume' },
  { id: 'volume_delta', label: 'Volume Delta', category: 'Volume' },
  { id: 'volume_oscillator', label: 'Volume Oscillator', category: 'Volume' },
  { id: 'volume_z_score', label: 'Volume Z-Score', category: 'Volume' },
  { id: 'volume_sma_ratio', label: 'Volume SMA Ratio', category: 'Volume' },
  { id: 'relative_volume', label: 'Relative Volume', category: 'Volume' },
  { id: 'net_volume', label: 'Net Volume', category: 'Volume' },
  { id: 'cumulative_volume_delta', label: 'Cumulative Volume Delta', category: 'Volume' },
  { id: 'cumulative_volume_index', label: 'Cumulative Volume Index', category: 'Volume' },
  { id: 'klinger_osc', label: 'Klinger Oscillator', category: 'Volume' },
  { id: 'emv_osc', label: 'EMV Oscillator', category: 'Volume' },
  { id: 'vwap_auto_anchored', label: 'Auto-Anchored VWAP', category: 'Volume' },
  { id: 'twap', label: 'TWAP', category: 'Volume' },
  { id: 'visible_avg_price', label: 'Visible Average Price', category: 'Volume' },
  { id: 'volume_24h', label: '24h Volume', category: 'Volume' },
  { id: 'relative_volume_at_time', label: 'Relative Volume At Time', category: 'Volume' },
  // Price / Statistical
  { id: 'pivot', label: 'Pivot Points', category: 'Price' },
  { id: 'ichimoku', label: 'Ichimoku Cloud', category: 'Price' },
  { id: 'price_channel_mid', label: 'Price Channel Mid', category: 'Price' },
  { id: 'price_channel_width', label: 'Price Channel Width', category: 'Price' },
  { id: 'median_price', label: 'Median Price', category: 'Price' },
  { id: 'typical_price', label: 'Typical Price', category: 'Price' },
  { id: 'weighted_close', label: 'Weighted Close', category: 'Price' },
  { id: 'rolling_high', label: 'Rolling High', category: 'Price' },
  { id: 'rolling_low', label: 'Rolling Low', category: 'Price' },
  { id: 'rolling_return', label: 'Rolling Return', category: 'Price' },
  { id: 'log_return', label: 'Log Return', category: 'Price' },
  { id: 'percentile_rank', label: 'Percentile Rank', category: 'Price' },
  { id: 'close_location_value', label: 'Close Location Value', category: 'Price' },
  { id: 'candle_body', label: 'Candle Body', category: 'Price' },
  { id: 'candle_body_percent', label: 'Candle Body %', category: 'Price' },
  { id: 'upper_wick', label: 'Upper Wick', category: 'Price' },
  { id: 'lower_wick', label: 'Lower Wick', category: 'Price' },
  { id: 'true_range_percent', label: 'True Range %', category: 'Price' },
  { id: 'range_sma_ratio', label: 'Range SMA Ratio', category: 'Price' },
  { id: 'performance', label: 'Performance', category: 'Price' },
  { id: 'correlation_coeff', label: 'Correlation Coefficient', category: 'Price' },
  { id: 'avg_daily_range', label: 'Avg Daily Range', category: 'Price' },
  { id: 'open_interest', label: 'Open Interest', category: 'Price' },
  { id: 'price_target', label: 'Price Target', category: 'Price' },
  { id: 'seasonality', label: 'Seasonality', category: 'Price' },
  { id: 'technical_ratings', label: 'Technical Ratings', category: 'Price' },
  { id: 'auto_fib_retracement', label: 'Auto Fib Retracement', category: 'Price' },
  { id: 'auto_fib_extension', label: 'Auto Fib Extension', category: 'Price' },
  { id: 'pivot_high_low', label: 'Pivot High/Low', category: 'Price' },
  { id: 'rob_booker_pivots', label: 'Rob Booker Pivots', category: 'Price' },
  { id: 'rob_booker_knoxville', label: 'Rob Booker Knoxville', category: 'Price' },
  { id: 'rob_booker_missed_pivots', label: 'Rob Booker Missed Pivots', category: 'Price' },
  { id: 'rob_booker_reversal', label: 'Rob Booker Reversal', category: 'Price' },
  { id: 'rob_booker_ziv_ghost', label: 'Rob Booker Ziv Ghost', category: 'Price' },
  { id: 'chop_zone', label: 'Chop Zone', category: 'Price' },
  { id: 'adv_decline_ratio', label: 'Advance/Decline Ratio', category: 'Price' },
  { id: 'adv_decline_ratio_bars', label: 'Advance/Decline Ratio Bars', category: 'Price' },
  { id: 'moon_phases', label: 'Moon Phases', category: 'Price' },
  { id: 'trading_sessions', label: 'Trading Sessions', category: 'Price' },
  // Bill Williams
  { id: 'fractal', label: 'Fractal', category: 'Bill Williams' },
  { id: 'alligator', label: 'Alligator', category: 'Bill Williams' },
  { id: 'gator', label: 'Gator Oscillator', category: 'Bill Williams' },
  { id: 'mfi_williams', label: 'Market Facilitation Index', category: 'Bill Williams' },
  // Candlestick Patterns
  { id: 'cp_doji', label: 'Doji', category: 'Candlestick Patterns' },
  { id: 'cp_hammer', label: 'Hammer', category: 'Candlestick Patterns' },
  { id: 'cp_shooting_star', label: 'Shooting Star', category: 'Candlestick Patterns' },
  { id: 'cp_engulfing', label: 'Engulfing', category: 'Candlestick Patterns' },
  { id: 'cp_morning_star', label: 'Morning Star', category: 'Candlestick Patterns' },
  { id: 'cp_evening_star', label: 'Evening Star', category: 'Candlestick Patterns' },
  { id: 'cp_harami', label: 'Harami', category: 'Candlestick Patterns' },
  { id: 'cp_three_white_soldiers', label: 'Three White Soldiers', category: 'Candlestick Patterns' },
  { id: 'cp_three_black_crows', label: 'Three Black Crows', category: 'Candlestick Patterns' },
  { id: 'cp_spinning_top', label: 'Spinning Top', category: 'Candlestick Patterns' },
  { id: 'cp_marubozu', label: 'Marubozu', category: 'Candlestick Patterns' },
  { id: 'cp_piercing_line', label: 'Piercing Line', category: 'Candlestick Patterns' },
  { id: 'cp_dark_cloud', label: 'Dark Cloud Cover', category: 'Candlestick Patterns' },
  { id: 'cp_tweezer', label: 'Tweezer', category: 'Candlestick Patterns' },
  { id: 'cp_abandoned_baby', label: 'Abandoned Baby', category: 'Candlestick Patterns' },
  { id: 'cp_doji_star', label: 'Doji Star', category: 'Candlestick Patterns' },
  { id: 'cp_dragonfly_doji', label: 'Dragonfly Doji', category: 'Candlestick Patterns' },
  { id: 'cp_gravestone_doji', label: 'Gravestone Doji', category: 'Candlestick Patterns' },
  { id: 'cp_hanging_man', label: 'Hanging Man', category: 'Candlestick Patterns' },
  { id: 'cp_inverted_hammer', label: 'Inverted Hammer', category: 'Candlestick Patterns' },
  { id: 'cp_kicking', label: 'Kicking', category: 'Candlestick Patterns' },
  { id: 'cp_rising_falling_three', label: 'Rising/Falling Three Methods', category: 'Candlestick Patterns' },
  { id: 'cp_three_inside', label: 'Three Inside', category: 'Candlestick Patterns' },
  { id: 'cp_three_outside', label: 'Three Outside', category: 'Candlestick Patterns' },
  { id: 'cp_tri_star', label: 'Tri-Star', category: 'Candlestick Patterns' },
  { id: 'cp_tweezer_top', label: 'Tweezer Top', category: 'Candlestick Patterns' },
  { id: 'cp_tweezer_bottom', label: 'Tweezer Bottom', category: 'Candlestick Patterns' },
  { id: 'cp_downside_tasuki_gap', label: 'Downside Tasuki Gap', category: 'Candlestick Patterns' },
  { id: 'cp_upside_tasuki_gap', label: 'Upside Tasuki Gap', category: 'Candlestick Patterns' },
  { id: 'cp_rising_window', label: 'Rising Window', category: 'Candlestick Patterns' },
  { id: 'cp_falling_window', label: 'Falling Window', category: 'Candlestick Patterns' },
  { id: 'cp_belt_hold', label: 'Belt Hold', category: 'Candlestick Patterns' },
  { id: 'cp_counterattack', label: 'Counterattack', category: 'Candlestick Patterns' },
  { id: 'cp_harami_cross', label: 'Harami Cross', category: 'Candlestick Patterns' },
  { id: 'cp_homing_pigeon', label: 'Homing Pigeon', category: 'Candlestick Patterns' },
  { id: 'cp_ladder_bottom', label: 'Ladder Bottom', category: 'Candlestick Patterns' },
  { id: 'cp_matching_low', label: 'Matching Low', category: 'Candlestick Patterns' },
  { id: 'cp_stick_sandwich', label: 'Stick Sandwich', category: 'Candlestick Patterns' },
  { id: 'cp_tasuki_line', label: 'Tasuki Line', category: 'Candlestick Patterns' },
  { id: 'cp_three_stars_in_south', label: 'Three Stars in South', category: 'Candlestick Patterns' },
  { id: 'cp_unique_three_river', label: 'Unique Three River', category: 'Candlestick Patterns' },
  { id: 'cp_long_upper_shadow', label: 'Long Upper Shadow', category: 'Candlestick Patterns' },
  { id: 'cp_long_lower_shadow', label: 'Long Lower Shadow', category: 'Candlestick Patterns' },
  { id: 'cp_marubozu_black', label: 'Black Marubozu', category: 'Candlestick Patterns' },
  { id: 'cp_marubozu_white', label: 'White Marubozu', category: 'Candlestick Patterns' },
  { id: 'cp_spinning_top_black', label: 'Black Spinning Top', category: 'Candlestick Patterns' },
  { id: 'cp_spinning_top_white', label: 'White Spinning Top', category: 'Candlestick Patterns' },
];

export const headerIndicatorItems: HeaderToolItem[] = INDICATOR_CATALOG.map((ind) => ({
  toolId: ind.id,
  toolName: ind.label,
  toolbar: 'header',
  category: 'indicator',
  testId: 'indicators-button',
  selectorType: 'button',
  options: [],
}));

// ─────────────────────────────────────────────────────────────────────────────
// Compute totals and export combined inventory
// ─────────────────────────────────────────────────────────────────────────────

function countOptionValues(items: DrawingToolItem[]): number {
  let total = 0;
  for (const item of items) {
    for (const opt of item.options) {
      total += opt.values.length;
    }
  }
  return total;
}

export function buildInventory(): ToolInventory {
  const allHeader = [...headerChartTypeItems, ...headerSnapModeItems, ...headerIndicatorItems];
  const totalOptionCombinations = countOptionValues(leftToolbarItems);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      leftToolbarDrawingTools: leftToolbarItems.length,
      cursorModes: cursorModeItems.length,
      headerChartTypes: headerChartTypeItems.length,
      headerIndicators: headerIndicatorItems.length,
      headerSnapModes: headerSnapModeItems.length,
      totalTools: leftToolbarItems.length + cursorModeItems.length + allHeader.length,
      totalOptionValueCombinations: totalOptionCombinations,
    },
    leftToolbar: leftToolbarItems,
    cursorModes: cursorModeItems,
    headerToolbar: allHeader,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers used by the matrix runner
// ─────────────────────────────────────────────────────────────────────────────

/** All drawing tools except icon/text-content variants (they don't auto-place without special UI) */
export const drawableTools: DrawingToolItem[] = leftToolbarItems.filter(
  (t) => !['image', 'post', 'idea', 'emoji', 'sticker', 'iconTool'].includes(t.toolId)
);

/** Tools with 1 anchor (point-click placement) */
export const pointOnlyTools: DrawingToolItem[] = drawableTools.filter((t) => t.pointOnly);

/** Tools requiring drag (2 anchors, not wizard) */
export const dragTools: DrawingToolItem[] = drawableTools.filter((t) => !t.pointOnly && !t.isWizard);

/** Tools requiring multiple clicks (wizard / multi-anchor) */
export const wizardTools: DrawingToolItem[] = drawableTools.filter((t) => t.isWizard);

/** Per-category representative tool (one per category for multi/fullscreen scenarios) */
export const categoryRepresentatives: DrawingToolItem[] = [
  drawableTools.find((t) => t.toolId === 'trend')!,
  drawableTools.find((t) => t.toolId === 'fibRetracement')!,
  drawableTools.find((t) => t.toolId === 'trianglePattern')!,
  drawableTools.find((t) => t.toolId === 'longPosition')!,
  drawableTools.find((t) => t.toolId === 'rectangle')!,
  drawableTools.find((t) => t.toolId === 'plainText')!,
].filter(Boolean);

/** Core tools for option coverage testing */
export const optionCoverageTools: DrawingToolItem[] = [
  drawableTools.find((t) => t.toolId === 'trend')!,
  drawableTools.find((t) => t.toolId === 'ray')!,
  drawableTools.find((t) => t.toolId === 'fibRetracement')!,
  drawableTools.find((t) => t.toolId === 'rectangle')!,
  drawableTools.find((t) => t.toolId === 'anchoredVwap')!,
  drawableTools.find((t) => t.toolId === 'longPosition')!,
  drawableTools.find((t) => t.toolId === 'plainText')!,
  drawableTools.find((t) => t.toolId === 'brush')!,
].filter(Boolean);
