import type { IndicatorDefinition } from '../types.ts';
import { strategiesPart1 } from './strategies-part1.ts';
import { strategiesPart2 } from './strategies-part2.ts';

export const allStrategies: IndicatorDefinition[] = [...strategiesPart1, ...strategiesPart2];
