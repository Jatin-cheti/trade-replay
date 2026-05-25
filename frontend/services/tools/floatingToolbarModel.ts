import type { Drawing } from './toolRegistry';

export const TREND_LINE_TOOLBAR_CONTROLS = [
  'templates',
  'line-tool-color',
  'text-color',
  'line-tool-width',
  'style',
  'settings',
  'add-alert',
  'lock',
  'remove',
  'more',
] as const;

export type VerifiedToolbarControlId = typeof TREND_LINE_TOOLBAR_CONTROLS[number];

export function getVerifiedToolbarControlIdsForDrawing(drawing: Pick<Drawing, 'variant'> | null): readonly VerifiedToolbarControlId[] {
  if (drawing?.variant === 'trend') return TREND_LINE_TOOLBAR_CONTROLS;
  return [];
}
