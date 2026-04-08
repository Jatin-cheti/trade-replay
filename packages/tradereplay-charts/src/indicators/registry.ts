/**
 * Global indicator registry.
 *
 * Indicators are registered once (typically at module-load time by
 * `indicators/builtins/index.ts`) and looked up by id when a chart calls
 * `addIndicator()`.
 */

import type { IndicatorDefinition, IndicatorId } from './types.ts';

const _registry = new Map<IndicatorId, IndicatorDefinition>();

/**
 * Register an indicator definition.  Subsequent registrations with the same
 * id overwrite the previous definition (useful for testing / hot-reload).
 */
export function registerIndicator(def: IndicatorDefinition): void {
  _registry.set(def.id, def);
}

/** Return the definition for `id`, or `undefined` if not registered. */
export function getIndicator(id: IndicatorId): IndicatorDefinition | undefined {
  return _registry.get(id);
}

/** Return all registered indicator definitions in registration order. */
export function listIndicators(): IndicatorDefinition[] {
  return Array.from(_registry.values());
}
