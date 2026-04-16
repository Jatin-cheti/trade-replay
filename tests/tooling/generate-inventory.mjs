#!/usr/bin/env node
/**
 * Generate tool-inventory.json
 *
 * Usage:
 *   node tests/tooling/generate-inventory.mjs
 *
 * Outputs: artifacts/tool-inventory.json
 *
 * This script is pure vanilla JS (no TypeScript compilation needed).
 * It mirrors the data in tool-inventory.ts exactly.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const ARTIFACTS_DIR = resolve(ROOT, 'artifacts');

// ─────────────────────────────────────────────────────────────────────────────
// Option value constants
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_VALUES = [
  { label: 'Cyan', value: '#00d1ff' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'White', value: '#ffffff' },
];

const THICKNESS_VALUES = [
  { label: '1px', value: 1 },
  { label: '2px', value: 2 },
  { label: '4px', value: 4 },
  { label: '8px', value: 8 },
];

const STYLE_VALUES = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
];

const OPACITY_VALUES = [
  { label: '15%', value: 0.15 },
  { label: '50%', value: 0.5 },
  { label: '95%', value: 0.95 },
  { label: '100%', value: 1 },
];

const BOOL_VALUES = [
  { label: 'On', value: true },
  { label: 'Off', value: false },
];

const SNAP_VALUES = [
  { label: 'Off', value: 'off' },
  { label: 'OHLC', value: 'ohlc' },
  { label: 'Nearest Candle', value: 'candle' },
];

const FIB_LABEL_VALUES = [
  { label: 'Percent', value: 'percent' },
  { label: 'Price', value: 'price' },
  { label: 'Both', value: 'both' },
];

const VWAP_INTERVAL_VALUES = [
  { label: 'Session', value: 'session' },
  { label: 'Weekly', value: 'week' },
  { label: 'Monthly', value: 'month' },
];

const POSITION_LABEL_VALUES = [
  { label: 'Risk/Reward', value: 'rr' },
  { label: 'Price Delta', value: 'price' },
  { label: 'Both', value: 'both' },
];

const FONT_VALUES = [
  { label: 'JetBrains Mono', value: 'JetBrains Mono' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'IBM Plex Sans', value: 'IBM Plex Sans' },
  { label: 'Space Grotesk', value: 'Space Grotesk' },
];

const TEXT_SIZE_VALUES = [
  { label: '10', value: 10 },
  { label: '12', value: 12 },
  { label: '18', value: 18 },
  { label: '28', value: 28 },
];

const TEXT_ALIGN_VALUES = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];

const BRUSH_SMOOTHNESS_VALUES = [
  { label: '0 (sharp)', value: 0 },
  { label: '0.45 (default)', value: 0.45 },
  { label: '1 (smooth)', value: 1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Option schema builders
// ─────────────────────────────────────────────────────────────────────────────

const BASE_OPTIONS = [
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

const LINE_OPTS = BASE_OPTIONS.filter(o =>
  !['font', 'bold', 'italic', 'align', 'textBackground', 'textBorder', 'textPadding', 'fibLevels', 'fibLabelMode', 'vwapInterval', 'positionLabelMode', 'brushSmoothness'].includes(o.optionId)
);

const TEXT_OPTS = [
  ...BASE_OPTIONS.filter(o =>
    !['extendLeft', 'extendRight', 'rayMode', 'fibLevels', 'fibLabelMode', 'vwapInterval', 'positionLabelMode', 'brushSmoothness'].includes(o.optionId)
  ),
  { optionId: 'font', optionName: 'Font', type: 'select', values: FONT_VALUES, defaultValue: 'JetBrains Mono' },
  { optionId: 'textSize', optionName: 'Font Size', type: 'range', values: TEXT_SIZE_VALUES, defaultValue: 12 },
  { optionId: 'bold', optionName: 'Bold', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
  { optionId: 'italic', optionName: 'Italic', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
  { optionId: 'align', optionName: 'Text Align', type: 'select', values: TEXT_ALIGN_VALUES, defaultValue: 'left' },
  { optionId: 'textBackground', optionName: 'Text Background', type: 'toggle', values: BOOL_VALUES, defaultValue: true },
  { optionId: 'textBorder', optionName: 'Text Border', type: 'toggle', values: BOOL_VALUES, defaultValue: false },
];

const SHAPE_OPTS = BASE_OPTIONS.filter(o =>
  !['rayMode', 'fibLevels', 'fibLabelMode', 'vwapInterval', 'brushSmoothness'].includes(o.optionId)
);

const BRUSH_OPTS = [
  ...BASE_OPTIONS.filter(o =>
    !['extendLeft', 'extendRight', 'rayMode', 'fibLevels', 'fibLabelMode', 'vwapInterval', 'positionLabelMode', 'font', 'bold', 'italic', 'align', 'textBackground', 'textBorder', 'textPadding'].includes(o.optionId)
  ),
  { optionId: 'brushSmoothness', optionName: 'Brush Smoothness', type: 'range', values: BRUSH_SMOOTHNESS_VALUES, defaultValue: 0.45 },
];

const FIB_OPTS = [
  ...BASE_OPTIONS.filter(o => !['vwapInterval', 'positionLabelMode', 'brushSmoothness'].includes(o.optionId)),
  { optionId: 'fibLevels', optionName: 'Fib Levels (CSV)', type: 'text', values: [
    { label: 'Default', value: '' },
    { label: 'Custom 3', value: '0,0.5,1' },
  ], defaultValue: '' },
  { optionId: 'fibLabelMode', optionName: 'Fib Label Mode', type: 'select', values: FIB_LABEL_VALUES, defaultValue: 'percent' },
];

const FORECAST_OPTS = [
  ...BASE_OPTIONS.filter(o => !['fibLevels', 'fibLabelMode', 'brushSmoothness'].includes(o.optionId)),
  { optionId: 'vwapInterval', optionName: 'VWAP Interval', type: 'select', values: VWAP_INTERVAL_VALUES, defaultValue: 'session', visibilityConditions: 'anchoredVwap only' },
  { optionId: 'positionLabelMode', optionName: 'Position Label', type: 'select', values: POSITION_LABEL_VALUES, defaultValue: 'rr', visibilityConditions: 'position tools only' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Test ID mapping
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_TEST_IDS = {
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

function getTestId(id) {
  return REQUIRED_TEST_IDS[id] ?? `tool-${id}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw tool definitions
// ─────────────────────────────────────────────────────────────────────────────

const RAW_TOOLS = [
  // Lines → Lines
  { id: 'trend', label: 'Trend line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, opts: LINE_OPTS },
  { id: 'ray', label: 'Ray', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, opts: LINE_OPTS },
  { id: 'infoLine', label: 'Info line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, opts: LINE_OPTS },
  { id: 'extendedLine', label: 'Extended line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, opts: LINE_OPTS },
  { id: 'trendAngle', label: 'Trend angle', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, opts: LINE_OPTS },
  { id: 'hline', label: 'Horizontal line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, opts: LINE_OPTS },
  { id: 'horizontalRay', label: 'Horizontal ray', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, opts: LINE_OPTS },
  { id: 'vline', label: 'Vertical line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, opts: LINE_OPTS },
  { id: 'crossLine', label: 'Cross line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, opts: LINE_OPTS },
  // Lines → Channels
  { id: 'channel', label: 'Parallel channel', category: 'lines', subSection: 'Channels', family: 'line', anchors: 2, opts: LINE_OPTS },
  { id: 'regressionTrend', label: 'Regression trend', category: 'lines', subSection: 'Channels', family: 'line', anchors: 2, opts: LINE_OPTS },
  { id: 'flatTopBottom', label: 'Flat top/bottom', category: 'lines', subSection: 'Channels', family: 'line', anchors: 2, opts: LINE_OPTS },
  { id: 'disjointChannel', label: 'Disjoint channel', category: 'lines', subSection: 'Channels', family: 'line', anchors: 4, opts: LINE_OPTS },
  // Lines → Pitchforks
  { id: 'pitchfork', label: 'Pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, opts: FIB_OPTS },
  { id: 'schiffPitchfork', label: 'Schiff pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, opts: FIB_OPTS },
  { id: 'modifiedSchiffPitchfork', label: 'Modified Schiff pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, opts: FIB_OPTS },
  { id: 'insidePitchfork', label: 'Inside pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, opts: FIB_OPTS },
  // Fibonacci
  { id: 'fibRetracement', label: 'Fib retracement', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'fibExtension', label: 'Fib extension', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'fibChannel', label: 'Fib channel', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'fibTimeZone', label: 'Fib time zone', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'fibSpeedResistFan', label: 'Fib speed resistance fan', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'fibTrendTime', label: 'Fib trend time', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'fibCircles', label: 'Fib circles', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'fibSpiral', label: 'Fib spiral', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'fibSpeedResistArcs', label: 'Fib speed resistance arcs', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'fibWedge', label: 'Fib wedge', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'pitchfan', label: 'Pitchfan', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 3, opts: FIB_OPTS },
  // Gann
  { id: 'gannBox', label: 'Gann box', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'gannSquareFixed', label: 'Gann square fixed', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'gannSquare', label: 'Gann square', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, opts: FIB_OPTS },
  { id: 'gannFan', label: 'Gann fan', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, opts: FIB_OPTS },
  // Patterns → Chart Patterns
  { id: 'xabcd', label: 'XABCD pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 5, opts: LINE_OPTS },
  { id: 'cypherPattern', label: 'Cypher pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 5, opts: LINE_OPTS },
  { id: 'headAndShoulders', label: 'Head and shoulders', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 5, opts: LINE_OPTS },
  { id: 'abcdPattern', label: 'ABCD pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 4, opts: LINE_OPTS },
  { id: 'trianglePattern', label: 'Triangle pattern', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 3, opts: LINE_OPTS },
  { id: 'threeDrives', label: 'Three drives', category: 'patterns', subSection: 'Chart Patterns', family: 'pattern', anchors: 7, opts: LINE_OPTS },
  // Patterns → Elliott Waves
  { id: 'elliottImpulse', label: 'Elliott impulse 1-2-3-4-5', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 5, opts: LINE_OPTS },
  { id: 'elliottCorrection', label: 'Elliott correction A-B-C', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 3, opts: LINE_OPTS },
  { id: 'elliottTriangle', label: 'Elliott triangle A-B-C-D-E', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 5, opts: LINE_OPTS },
  { id: 'elliottDoubleCombo', label: 'Elliott double combo W-X-Y', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 3, opts: LINE_OPTS },
  { id: 'elliottTripleCombo', label: 'Elliott triple combo W-X-Y-X-Z', category: 'patterns', subSection: 'Elliott Waves', family: 'pattern', anchors: 5, opts: LINE_OPTS },
  // Patterns → Cycles
  { id: 'cyclicLines', label: 'Cyclic lines', category: 'patterns', subSection: 'Cycles', family: 'pattern', anchors: 2, opts: LINE_OPTS },
  { id: 'timeCycles', label: 'Time cycles', category: 'patterns', subSection: 'Cycles', family: 'pattern', anchors: 2, opts: LINE_OPTS },
  { id: 'sineLine', label: 'Sine line', category: 'patterns', subSection: 'Cycles', family: 'pattern', anchors: 2, opts: LINE_OPTS },
  // Forecasting
  { id: 'longPosition', label: 'Long position', category: 'forecasting', subSection: 'Forecasting', family: 'position', anchors: 3, opts: FORECAST_OPTS },
  { id: 'shortPosition', label: 'Short position', category: 'forecasting', subSection: 'Forecasting', family: 'position', anchors: 3, opts: FORECAST_OPTS },
  { id: 'positionForecast', label: 'Position forecast', category: 'forecasting', subSection: 'Forecasting', family: 'position', anchors: 3, opts: FORECAST_OPTS },
  { id: 'barPattern', label: 'Bar pattern', category: 'forecasting', subSection: 'Forecasting', family: 'pattern', anchors: 2, opts: FORECAST_OPTS },
  { id: 'ghostFeed', label: 'Ghost feed', category: 'forecasting', subSection: 'Forecasting', family: 'pattern', anchors: 2, opts: FORECAST_OPTS },
  { id: 'sector', label: 'Sector', category: 'forecasting', subSection: 'Forecasting', family: 'shape', anchors: 2, opts: FORECAST_OPTS },
  // Volume-based
  { id: 'anchoredVwap', label: 'Anchored VWAP', category: 'forecasting', subSection: 'Volume-based', family: 'line', anchors: 1, opts: FORECAST_OPTS },
  { id: 'fixedRangeVolumeProfile', label: 'Fixed range volume profile', category: 'forecasting', subSection: 'Volume-based', family: 'measure', anchors: 2, opts: FORECAST_OPTS },
  { id: 'anchoredVolumeProfile', label: 'Anchored volume profile', category: 'forecasting', subSection: 'Volume-based', family: 'measure', anchors: 1, opts: FORECAST_OPTS },
  // Measurers
  { id: 'priceRange', label: 'Price range', category: 'forecasting', subSection: 'Measurers', family: 'measure', anchors: 2, opts: FORECAST_OPTS },
  { id: 'dateRange', label: 'Date range', category: 'forecasting', subSection: 'Measurers', family: 'measure', anchors: 2, opts: FORECAST_OPTS },
  { id: 'dateAndPriceRange', label: 'Date and price range', category: 'forecasting', subSection: 'Measurers', family: 'measure', anchors: 2, opts: FORECAST_OPTS },
  // Brush
  { id: 'brush', label: 'Brush', category: 'brush', subSection: 'Brushes', family: 'shape', anchors: 2, opts: BRUSH_OPTS },
  { id: 'highlighter', label: 'Highlighter', category: 'brush', subSection: 'Brushes', family: 'shape', anchors: 2, opts: BRUSH_OPTS },
  { id: 'arrowMarker', label: 'Arrow marker', category: 'brush', subSection: 'Arrows', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'arrowTool', label: 'Arrow', category: 'brush', subSection: 'Arrows', family: 'line', anchors: 2, opts: LINE_OPTS },
  { id: 'arrowMarkUp', label: 'Arrow mark up', category: 'brush', subSection: 'Arrows', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'arrowMarkDown', label: 'Arrow mark down', category: 'brush', subSection: 'Arrows', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'rectangle', label: 'Rectangle', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, opts: SHAPE_OPTS },
  { id: 'rotatedRectangle', label: 'Rotated rectangle', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, opts: SHAPE_OPTS },
  { id: 'path', label: 'Path', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, opts: BRUSH_OPTS },
  { id: 'circle', label: 'Circle', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, opts: SHAPE_OPTS },
  { id: 'ellipse', label: 'Ellipse', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, opts: SHAPE_OPTS },
  { id: 'polyline', label: 'Polyline', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, opts: BRUSH_OPTS },
  { id: 'triangle', label: 'Triangle', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, opts: SHAPE_OPTS },
  { id: 'arc', label: 'Arc', category: 'brush', subSection: 'Shapes', family: 'shape', anchors: 2, opts: SHAPE_OPTS },
  { id: 'curveTool', label: 'Curve', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, opts: BRUSH_OPTS },
  { id: 'doubleCurve', label: 'Double curve', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, opts: BRUSH_OPTS },
  // Text
  { id: 'plainText', label: 'Text', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'anchoredText', label: 'Anchored text', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'note', label: 'Note', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'priceNote', label: 'Price note', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'pin', label: 'Pin', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'table', label: 'Table', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'callout', label: 'Callout', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'comment', label: 'Comment', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'priceLabel', label: 'Price label', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'signpost', label: 'Signpost', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'flagMark', label: 'Flag mark', category: 'text', subSection: 'Text and Notes', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'image', label: 'Image', category: 'text', subSection: 'Content', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'post', label: 'Post', category: 'text', subSection: 'Content', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'idea', label: 'Idea', category: 'text', subSection: 'Content', family: 'text', anchors: 1, opts: TEXT_OPTS },
  // Icons
  { id: 'emoji', label: 'Emojis', category: 'icon', subSection: 'Emojis', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'sticker', label: 'Stickers', category: 'icon', subSection: 'Stickers', family: 'text', anchors: 1, opts: TEXT_OPTS },
  { id: 'iconTool', label: 'Icons', category: 'icon', subSection: 'Icons', family: 'text', anchors: 1, opts: TEXT_OPTS },
];

const leftTools = RAW_TOOLS.map(t => ({
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
  options: t.opts,
}));

const cursorModes = [
  { toolId: 'cross', toolName: 'Cross', toolbar: 'left', category: 'cursor', testId: 'cursor-cross' },
  { toolId: 'dot', toolName: 'Dot', toolbar: 'left', category: 'cursor', testId: 'cursor-dot' },
  { toolId: 'arrow', toolName: 'Arrow', toolbar: 'left', category: 'cursor', testId: 'cursor-arrow' },
  { toolId: 'eraser', toolName: 'Eraser', toolbar: 'left', category: 'cursor', testId: 'cursor-eraser' },
];

// Chart types
const CHART_TYPES = [
  { id: 'candlestick', label: 'Candlestick', testId: 'chart-type-candlestick', selectorType: 'button' },
  { id: 'line', label: 'Line', testId: 'chart-type-line', selectorType: 'button' },
  { id: 'area', label: 'Area', testId: 'chart-type-area', selectorType: 'button' },
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

const headerChartTypes = CHART_TYPES.map(ct => ({
  toolId: ct.id,
  toolName: ct.label,
  toolbar: 'header',
  category: 'chartType',
  testId: ct.testId,
  selectorType: ct.selectorType,
  options: [],
}));

const headerSnapModes = [
  { toolId: 'snap-free', toolName: 'Snap: Free', toolbar: 'header', category: 'snapMode', testId: 'chart-snap-mode', selectorType: 'dropdown-option', options: [] },
  { toolId: 'snap-time', toolName: 'Snap: Time', toolbar: 'header', category: 'snapMode', testId: 'chart-snap-mode', selectorType: 'dropdown-option', options: [] },
  { toolId: 'snap-ohlc', toolName: 'Snap: OHLC', toolbar: 'header', category: 'snapMode', testId: 'chart-snap-mode', selectorType: 'dropdown-option', options: [] },
];

const INDICATOR_CATALOG = [
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
  { id: 'volume', label: 'Volume', category: 'Volume' },
  { id: 'volume_delta', label: 'Volume Delta', category: 'Volume' },
  { id: 'volume_oscillator', label: 'Volume Oscillator', category: 'Volume' },
  { id: 'net_volume', label: 'Net Volume', category: 'Volume' },
  { id: 'cumulative_volume_delta', label: 'Cumulative Volume Delta', category: 'Volume' },
  { id: 'cumulative_volume_index', label: 'Cumulative Volume Index', category: 'Volume' },
  { id: 'klinger_osc', label: 'Klinger Oscillator', category: 'Volume' },
  { id: 'vwap_auto_anchored', label: 'Auto-Anchored VWAP', category: 'Volume' },
  { id: 'twap', label: 'TWAP', category: 'Volume' },
  { id: 'volume_24h', label: '24h Volume', category: 'Volume' },
  // Price / Statistical
  { id: 'pivot', label: 'Pivot Points', category: 'Price' },
  { id: 'ichimoku', label: 'Ichimoku Cloud', category: 'Price' },
  { id: 'auto_fib_retracement', label: 'Auto Fib Retracement', category: 'Price' },
  { id: 'zigzag', label: 'Zig Zag', category: 'Price' },
  { id: 'seasonality', label: 'Seasonality', category: 'Price' },
  { id: 'technical_ratings', label: 'Technical Ratings', category: 'Price' },
  { id: 'trading_sessions', label: 'Trading Sessions', category: 'Price' },
  // Bill Williams
  { id: 'fractal', label: 'Fractal', category: 'Bill Williams' },
  { id: 'alligator', label: 'Alligator', category: 'Bill Williams' },
  { id: 'gator', label: 'Gator Oscillator', category: 'Bill Williams' },
  { id: 'mfi_williams', label: 'Market Facilitation Index', category: 'Bill Williams' },
  // Candlestick Patterns
  { id: 'cp_doji', label: 'Doji', category: 'Candlestick Patterns' },
  { id: 'cp_hammer', label: 'Hammer', category: 'Candlestick Patterns' },
  { id: 'cp_engulfing', label: 'Engulfing', category: 'Candlestick Patterns' },
  { id: 'cp_morning_star', label: 'Morning Star', category: 'Candlestick Patterns' },
  { id: 'cp_evening_star', label: 'Evening Star', category: 'Candlestick Patterns' },
  { id: 'cp_shooting_star', label: 'Shooting Star', category: 'Candlestick Patterns' },
];

const headerIndicators = INDICATOR_CATALOG.map(ind => ({
  toolId: ind.id,
  toolName: ind.label,
  toolbar: 'header',
  category: 'indicator',
  testId: 'indicators-button',
  selectorType: 'button',
  options: [],
  indicatorCategory: ind.category,
}));

// Compute totals
const allHeader = [...headerChartTypes, ...headerSnapModes, ...headerIndicators];
let totalOptionCombinations = 0;
for (const tool of leftTools) {
  for (const opt of tool.options) {
    totalOptionCombinations += opt.values.length;
  }
}

const inventory = {
  generatedAt: new Date().toISOString(),
  totals: {
    leftToolbarDrawingTools: leftTools.length,
    cursorModes: cursorModes.length,
    headerChartTypes: headerChartTypes.length,
    headerIndicators: headerIndicators.length,
    headerSnapModes: headerSnapModes.length,
    totalTools: leftTools.length + cursorModes.length + allHeader.length,
    totalOptionValueCombinations: totalOptionCombinations,
  },
  leftToolbar: leftTools,
  cursorModes: cursorModes,
  headerToolbar: allHeader,
};

// Write output
mkdirSync(ARTIFACTS_DIR, { recursive: true });
const outPath = resolve(ARTIFACTS_DIR, 'tool-inventory.json');
writeFileSync(outPath, JSON.stringify(inventory, null, 2), 'utf8');

console.log(`✅ Tool inventory written to: ${outPath}`);
console.log(`   Left toolbar (drawing tools): ${inventory.totals.leftToolbarDrawingTools}`);
console.log(`   Cursor modes: ${inventory.totals.cursorModes}`);
console.log(`   Header chart types: ${inventory.totals.headerChartTypes}`);
console.log(`   Header indicators: ${inventory.totals.headerIndicators}`);
console.log(`   Header snap modes: ${inventory.totals.headerSnapModes}`);
console.log(`   TOTAL tools: ${inventory.totals.totalTools}`);
console.log(`   Total option×value combinations: ${inventory.totals.totalOptionValueCombinations}`);
