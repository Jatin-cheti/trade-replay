export type ToolOptions = {
  color: string;
  thickness: number;
  style: 'solid' | 'dashed' | 'dotted';
  opacity: number;
  extendLeft: boolean;
  extendRight: boolean;
  rayMode: boolean;
  priceLabel: boolean;
  axisLabel: boolean;
  snapMode: 'off' | 'ohlc' | 'candle';
  fibLevels: string;
  // 'ratio-price' is TradingView's default Fib label format: e.g. "0.236 (1,398.80)".
  fibLabelMode: 'ratio-price' | 'percent' | 'price' | 'both' | 'ratio';
  vwapInterval: 'session' | 'week' | 'month';
  positionLabelMode: 'rr' | 'price' | 'both';
  brushSmoothness: number;
  font: string;
  textSize: number;
  textMaxWidth: number;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  textBackground: boolean;
  textBorder: boolean;
  textPadding: number;
  locked: boolean;
  visible: boolean;
};

export type OptionFieldType = 'color' | 'number' | 'range' | 'select' | 'toggle' | 'text';

export type OptionField = {
  key: keyof ToolOptions;
  label: string;
  type: OptionFieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
};

export const baseOptionSchema: OptionField[] = [
  { key: 'color', label: 'Stroke Color', type: 'color' },
  { key: 'opacity', label: 'Opacity', type: 'range', min: 0.15, max: 1, step: 0.05 },
  { key: 'thickness', label: 'Line Width', type: 'range', min: 1, max: 8, step: 1 },
  {
    key: 'style',
    label: 'Line Style',
    type: 'select',
    options: [
      { label: 'Solid', value: 'solid' },
      { label: 'Dashed', value: 'dashed' },
      { label: 'Dotted', value: 'dotted' },
    ],
  },
  { key: 'extendLeft', label: 'Extend Left', type: 'toggle' },
  { key: 'extendRight', label: 'Extend Right', type: 'toggle' },
  { key: 'rayMode', label: 'Ray Mode', type: 'toggle' },
  {
    key: 'snapMode',
    label: 'Snap Mode',
    type: 'select',
    options: [
      { label: 'Off', value: 'off' },
      { label: 'OHLC', value: 'ohlc' },
      { label: 'Nearest Candle', value: 'candle' },
    ],
  },
  { key: 'fibLevels', label: 'Fib Levels (CSV)', type: 'text' },
  {
    key: 'fibLabelMode',
    label: 'Fib Label Mode',
    type: 'select',
    options: [
      // TradingView default, e.g. "0.236 (1,398.80)".
      { label: 'Ratio + Price', value: 'ratio-price' },
      { label: 'Ratio', value: 'ratio' },
      { label: 'Percent', value: 'percent' },
      { label: 'Price', value: 'price' },
      { label: 'Percent + Price', value: 'both' },
    ],
  },
  {
    key: 'vwapInterval',
    label: 'VWAP Interval',
    type: 'select',
    options: [
      { label: 'Session', value: 'session' },
      { label: 'Weekly', value: 'week' },
      { label: 'Monthly', value: 'month' },
    ],
  },
  {
    key: 'positionLabelMode',
    label: 'Position Label',
    type: 'select',
    options: [
      { label: 'Risk/Reward', value: 'rr' },
      { label: 'Price Delta', value: 'price' },
      { label: 'Both', value: 'both' },
    ],
  },
  { key: 'brushSmoothness', label: 'Brush Smoothness', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'priceLabel', label: 'Price Label', type: 'toggle' },
  { key: 'axisLabel', label: 'Axis Label', type: 'toggle' },
  {
    key: 'font',
    label: 'Font',
    type: 'select',
    options: [
      { label: 'JetBrains Mono', value: 'JetBrains Mono' },
      { label: 'Poppins', value: 'Poppins' },
      { label: 'IBM Plex Sans', value: 'IBM Plex Sans' },
      { label: 'Space Grotesk', value: 'Space Grotesk' },
    ],
  },
  { key: 'textSize', label: 'Font Size', type: 'range', min: 10, max: 28, step: 1 },
  { key: 'textMaxWidth', label: 'Text Max Width', type: 'range', min: 120, max: 640, step: 20 },
  { key: 'bold', label: 'Bold', type: 'toggle' },
  { key: 'italic', label: 'Italic', type: 'toggle' },
  {
    key: 'align',
    label: 'Text Align',
    type: 'select',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ],
  },
  { key: 'textBackground', label: 'Text Background', type: 'toggle' },
  { key: 'textBorder', label: 'Text Border', type: 'toggle' },
  { key: 'textPadding', label: 'Text Padding', type: 'range', min: 0, max: 24, step: 1 },
  { key: 'locked', label: 'Lock', type: 'toggle' },
  { key: 'visible', label: 'Visible', type: 'toggle' },
];

export const defaultToolOptions: ToolOptions = {
  color: '#00d1ff',
  thickness: 2,
  style: 'solid',
  opacity: 0.95,
  extendLeft: false,
  extendRight: false,
  rayMode: false,
  priceLabel: true,
  axisLabel: true,
  snapMode: 'off',
  fibLevels: '',
  // Match TradingView default labelling for Fib tools.
  fibLabelMode: 'ratio-price',
  vwapInterval: 'session',
  positionLabelMode: 'rr',
  brushSmoothness: 0.45,
  font: 'JetBrains Mono',
  textSize: 12,
  textMaxWidth: 240,
  bold: false,
  italic: false,
  align: 'left',
  textBackground: true,
  textBorder: false,
  textPadding: 4,
  locked: false,
  visible: true,
};

export function mergeToolOptions(base: ToolOptions, partial: Partial<ToolOptions>): ToolOptions {
  return { ...base, ...partial };
}

export function clampOptionValue(options: ToolOptions): ToolOptions {
  return {
    ...options,
    thickness: Math.max(1, Math.min(8, options.thickness)),
    opacity: Math.max(0.15, Math.min(1, options.opacity)),
    textSize: Math.max(10, Math.min(28, options.textSize)),
    textMaxWidth: Math.max(120, Math.min(640, options.textMaxWidth)),
    brushSmoothness: Math.max(0, Math.min(1, options.brushSmoothness)),
    textPadding: Math.max(0, Math.min(24, options.textPadding)),
  };
}

export function rgbFromHex(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  const num = Number.parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}
