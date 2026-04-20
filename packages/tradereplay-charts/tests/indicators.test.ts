import assert from 'node:assert/strict';
import { getIndicator, listIndicators } from '../src/indicators/registry.ts';
import { registerBuiltins } from '../src/indicators/builtins/index.ts';
import type { IndicatorDefinition } from '../src/indicators/types.ts';
import * as batch5Builtins from '../src/indicators/builtins/batch5.ts';
import * as billWilliamsBuiltins from '../src/indicators/builtins/billWilliams.ts';
import * as candlePatternBuiltins from '../src/indicators/builtins/candlePatterns.ts';
import * as candlePattern2Builtins from '../src/indicators/builtins/candlePatterns2.ts';
import * as strategyBuiltins from '../src/indicators/builtins/strategies.ts';
import * as profileBuiltins from '../src/indicators/builtins/profiles.ts';
import * as chartPatternBuiltins from '../src/indicators/builtins/chartPatterns.ts';
import * as stubBuiltins from '../src/indicators/builtins/stubs.ts';

type Num = number | null;

interface TestCase {
  id: string;
  params?: Record<string, number>;
  expectedOutputs: number;
  expectedWarmup: number;
  validate: (outputs: Num[][]) => void;
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`      ${(err as Error).message}`);
    failed++;
  }
}

function closeTo(a: number | null, b: number, eps = 1e-6): boolean {
  if (a == null) return false;
  return Math.abs(a - b) <= eps;
}

function isIndicatorDefinition(value: unknown): value is IndicatorDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IndicatorDefinition>;
  return (
    typeof candidate.id === 'string'
    && Array.isArray(candidate.inputs)
    && Array.isArray(candidate.outputs)
    && typeof candidate.compute === 'function'
  );
}

function collectModuleIndicatorIds(moduleExports: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();

  for (const value of Object.values(moduleExports)) {
    if (isIndicatorDefinition(value)) {
      ids.add(value.id);
      continue;
    }

    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (isIndicatorDefinition(entry)) {
        ids.add(entry.id);
      }
    }
  }

  return ids;
}

function sortedIds(ids: Iterable<string>): string[] {
  return Array.from(new Set(ids)).sort((left, right) => left.localeCompare(right));
}

const n = 160;
const times = Array.from({ length: n }, (_, i) => 1_700_000_000 + i * 60) as readonly number[];
const open = Array.from({ length: n }, (_, i) => 100 + i * 0.35 + Math.sin(i * 0.12) * 1.3) as readonly number[];
const high = open.map((v, i) => v + 1.4 + Math.sin(i * 0.04) * 0.3) as readonly number[];
const low = open.map((v, i) => v - 1.1 - Math.cos(i * 0.06) * 0.2) as readonly number[];
const close = open.map((v, i) => v + Math.cos(i * 0.1) * 0.7) as readonly number[];
const volume = Array.from({ length: n }, (_, i) => 1000 + (i % 11) * 41 + i * 3) as readonly number[];

const ctxBase = {
  times,
  open,
  high,
  low,
  close,
  volume,
};

registerBuiltins();

console.log('\nRegistry');

const addedIds = [
  'wma', 'vwap', 'bbands', 'donchian', 'keltner', 'atr', 'supertrend', 'psar', 'pivot',
  'stochastic', 'cci', 'roc', 'momentum', 'williams_r', 'mfi', 'obv', 'cmf', 'adx',
  'aroon', 'trix', 'ultimate', 'chaikin_osc', 'awesome', 'dpo', 'ichimoku',
  'hma', 'dema', 'tema', 'zlema', 'kama', 'alma', 'lsma', 'stoch_rsi', 'rvi', 'ppo', 'pvo', 'tsi',
  'dx', 'crsi', 'elder_ray', 'cmo', 'fisher', 'kdj', 'bollinger_percent_b', 'bollinger_bandwidth',
  'chaikin_volatility', 'stddev', 'variance', 'adl', 'force_index', 'eom', 'nvi', 'pvi', 'vpt',
  'aroon_oscillator', 'vortex',
  'trima', 'smma', 'apo', 'smi', 'choppiness', 'ulcer_index', 'mass_index', 'qstick', 'relative_volume',
  'balance_of_power', 'emv_osc', 'volatility_ratio', 'linear_reg_slope', 'linear_reg_intercept',
  'linear_reg_angle', 'price_channel_mid', 'median_price', 'typical_price', 'weighted_close',
  'volume_oscillator',
  'coppock_curve', 'percentile_rank', 'normalized_atr', 'price_channel_width', 'close_location_value',
  'candle_body', 'candle_body_percent', 'upper_wick', 'lower_wick', 'true_range_percent', 'rolling_high',
  'rolling_low', 'volume_zscore', 'volume_sma_ratio', 'range_sma_ratio', 'cumulative_volume_delta',
  'rolling_return', 'log_return', 'volatility_ema', 'breakout_strength', 'trend_strength',
] as const;

const requiredCoreIds = ['sma', 'ema', 'rsi', 'macd', ...addedIds] as const;
const extendedManifestModules = [
  batch5Builtins,
  billWilliamsBuiltins,
  candlePatternBuiltins,
  candlePattern2Builtins,
  strategyBuiltins,
  profileBuiltins,
  chartPatternBuiltins,
  stubBuiltins,
] as const;
const extendedManifestIds = sortedIds(
  extendedManifestModules.flatMap((moduleExports) => Array.from(collectModuleIndicatorIds(moduleExports))),
);
const expectedRegistryIds = sortedIds([...requiredCoreIds, ...extendedManifestIds]);

test('registerBuiltins keeps legacy minimum indicator coverage', () => {
  const count = new Set(listIndicators().map((d) => d.id)).size;
  assert.ok(count >= 101, `expected at least 101 indicators, got ${count}`);
});

test('registerBuiltins registry matches builtin manifest exactly', () => {
  const registryIds = sortedIds(listIndicators().map((d) => d.id));
  assert.deepEqual(registryIds, expectedRegistryIds);
});

test('builtin indicator manifest has no duplicate ids', () => {
  const manifestIds = [...requiredCoreIds, ...extendedManifestIds];
  const uniqueCount = new Set(manifestIds).size;
  assert.equal(uniqueCount, manifestIds.length, 'duplicate indicator ids detected in expected manifest');
});

test('all expected indicator ids are registered', () => {
  const ids = new Set(listIndicators().map((d) => d.id));
  for (const id of addedIds) {
    assert.ok(ids.has(id), `missing indicator ${id}`);
  }
});

test('required indicator pane semantics are preserved', () => {
  const volumeDef = getIndicator('volume');
  assert.ok(volumeDef, 'missing definition: volume');
  assert.ok(volumeDef!.outputs.length > 0, 'volume must expose at least one output series');
  assert.ok(
    volumeDef!.outputs.every((series) => series.pane === 'subpane'),
    'volume outputs must render in subpane',
  );

  const smaDef = getIndicator('sma');
  assert.ok(smaDef, 'missing definition: sma');
  assert.ok(smaDef!.outputs.every((series) => series.pane === 'overlay'), 'sma outputs must remain overlay');
});

const cases: TestCase[] = [
  {
    id: 'wma', params: { period: 10 }, expectedOutputs: 1, expectedWarmup: 9,
    validate(outputs) {
      assert.ok(outputs[0][30] != null);
    },
  },
  {
    id: 'vwap', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(closeTo(outputs[0][0], (high[0] + low[0] + close[0]) / 3));
      assert.ok(outputs[0][60]! >= Math.min(...close.slice(0, 61)));
    },
  },
  {
    id: 'bbands', params: { period: 20, mult: 2 }, expectedOutputs: 3, expectedWarmup: 19,
    validate(outputs) {
      const basis = outputs[0][40]!;
      const upper = outputs[1][40]!;
      const lower = outputs[2][40]!;
      assert.ok(upper >= basis && basis >= lower);
    },
  },
  {
    id: 'donchian', params: { period: 20 }, expectedOutputs: 3, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][45]! >= outputs[2][45]!);
      assert.ok(outputs[2][45]! >= outputs[1][45]!);
    },
  },
  {
    id: 'keltner', params: { period: 20, mult: 2 }, expectedOutputs: 3, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[1][50]! >= outputs[0][50]!);
      assert.ok(outputs[0][50]! >= outputs[2][50]!);
    },
  },
  {
    id: 'atr', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 13,
    validate(outputs) {
      assert.ok(outputs[0][30]! > 0);
    },
  },
  {
    id: 'supertrend', params: { period: 10, mult: 3 }, expectedOutputs: 2, expectedWarmup: 9,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
      const d = outputs[1][40];
      assert.ok(d === 1 || d === -1);
    },
  },
  {
    id: 'psar', params: { step: 0.02, maxStep: 0.2 }, expectedOutputs: 1, expectedWarmup: 1,
    validate(outputs) {
      assert.ok(outputs[0][20] != null);
    },
  },
  {
    id: 'pivot', params: { period: 24 }, expectedOutputs: 5, expectedWarmup: 23,
    validate(outputs) {
      assert.ok(outputs[1][50]! >= outputs[0][50]!);
      assert.ok(outputs[0][50]! >= outputs[2][50]!);
    },
  },
  {
    id: 'stochastic', params: { period: 14, smoothD: 3 }, expectedOutputs: 2, expectedWarmup: 13,
    validate(outputs) {
      assert.ok(outputs[0][35]! >= 0 && outputs[0][35]! <= 100);
      assert.ok(outputs[1][35] != null);
    },
  },
  {
    id: 'cci', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'roc', params: { period: 12 }, expectedOutputs: 1, expectedWarmup: 12,
    validate(outputs) {
      assert.ok(outputs[0][30] != null);
    },
  },
  {
    id: 'momentum', params: { period: 10 }, expectedOutputs: 1, expectedWarmup: 10,
    validate(outputs) {
      assert.ok(closeTo(outputs[0][20], close[20] - close[10]));
    },
  },
  {
    id: 'williams_r', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 13,
    validate(outputs) {
      const v = outputs[0][35]!;
      assert.ok(v <= 0 && v >= -100);
    },
  },
  {
    id: 'mfi', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 14,
    validate(outputs) {
      const v = outputs[0][40]!;
      assert.ok(v >= 0 && v <= 100);
    },
  },
  {
    id: 'obv', expectedOutputs: 1, expectedWarmup: 1,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'cmf', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][45] != null);
    },
  },
  {
    id: 'adx', params: { period: 14 }, expectedOutputs: 3, expectedWarmup: 13,
    validate(outputs) {
      assert.ok(outputs[0][50] != null);
      assert.ok(outputs[1][50] != null);
      assert.ok(outputs[2][50] != null);
    },
  },
  {
    id: 'aroon', params: { period: 25 }, expectedOutputs: 2, expectedWarmup: 24,
    validate(outputs) {
      assert.ok(outputs[0][50]! >= 0 && outputs[0][50]! <= 100);
      assert.ok(outputs[1][50]! >= 0 && outputs[1][50]! <= 100);
    },
  },
  {
    id: 'trix', params: { period: 15 }, expectedOutputs: 1, expectedWarmup: 43,
    validate(outputs) {
      assert.ok(outputs[0][70] != null);
    },
  },
  {
    id: 'ultimate', params: { short: 7, mid: 14, long: 28 }, expectedOutputs: 1, expectedWarmup: 27,
    validate(outputs) {
      const v = outputs[0][50]!;
      assert.ok(v >= 0 && v <= 100);
    },
  },
  {
    id: 'chaikin_osc', params: { fast: 3, slow: 10 }, expectedOutputs: 1, expectedWarmup: 9,
    validate(outputs) {
      assert.ok(outputs[0][30] != null);
    },
  },
  {
    id: 'awesome', expectedOutputs: 1, expectedWarmup: 33,
    validate(outputs) {
      assert.ok(outputs[0][50] != null);
    },
  },
  {
    id: 'dpo', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'ichimoku', params: { conv: 9, base: 26, spanB: 52, disp: 26 }, expectedOutputs: 5, expectedWarmup: 8,
    validate(outputs) {
      assert.ok(outputs[0][20] != null);
      assert.ok(outputs[1][30] != null);
      assert.ok(outputs[2][80] != null);
      assert.ok(outputs[3][100] != null);
      assert.ok(outputs[4][20] != null);
    },
  },
  {
    id: 'hma', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 22,
    validate(outputs) {
      assert.ok(outputs[0][45] != null);
    },
  },
  {
    id: 'dema', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 38,
    validate(outputs) {
      assert.ok(outputs[0][60] != null);
    },
  },
  {
    id: 'tema', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 57,
    validate(outputs) {
      assert.ok(outputs[0][90] != null);
    },
  },
  {
    id: 'zlema', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'kama', params: { period: 10, fast: 2, slow: 30 }, expectedOutputs: 1, expectedWarmup: 10,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'alma', params: { period: 9, sigma: 6, offset: 0.85 }, expectedOutputs: 1, expectedWarmup: 8,
    validate(outputs) {
      assert.ok(outputs[0][25] != null);
    },
  },
  {
    id: 'lsma', params: { period: 25 }, expectedOutputs: 1, expectedWarmup: 24,
    validate(outputs) {
      assert.ok(outputs[0][55] != null);
    },
  },
  {
    id: 'stoch_rsi', params: { rsi: 14, stoch: 14, k: 3, d: 3 }, expectedOutputs: 2, expectedWarmup: 0,
    validate(outputs) {
      for (const v of outputs[0]) {
        if (v == null) continue;
        assert.ok(v >= 0 && v <= 100);
      }
      for (const v of outputs[1]) {
        if (v == null) continue;
        assert.ok(v >= 0 && v <= 100);
      }
    },
  },
  {
    id: 'rvi', params: { period: 10 }, expectedOutputs: 2, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][30] != null);
      assert.ok(outputs[1][35] != null);
    },
  },
  {
    id: 'ppo', params: { fast: 12, slow: 26, signal: 9 }, expectedOutputs: 3, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][50] != null);
      assert.ok(outputs[1][55] != null);
      assert.ok(outputs[2][55] != null);
    },
  },
  {
    id: 'pvo', params: { fast: 12, slow: 26, signal: 9 }, expectedOutputs: 3, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][50] != null);
      assert.ok(outputs[1][55] != null);
      assert.ok(outputs[2][55] != null);
    },
  },
  {
    id: 'tsi', params: { long: 25, short: 13, signal: 7 }, expectedOutputs: 2, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][60] != null);
      assert.ok(outputs[1][70] != null);
    },
  },
  {
    id: 'dx', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      const v = outputs[0][50]!;
      assert.ok(v >= 0 && v <= 100);
    },
  },
  {
    id: 'crsi', params: { rsi: 3, streak: 2, rank: 100 }, expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      const v = outputs[0][120]!;
      assert.ok(v >= 0 && v <= 100);
    },
  },
  {
    id: 'elder_ray', params: { period: 13 }, expectedOutputs: 2, expectedWarmup: 12,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
      assert.ok(outputs[1][40] != null);
    },
  },
  {
    id: 'cmo', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 14,
    validate(outputs) {
      const v = outputs[0][60]!;
      assert.ok(v <= 100 && v >= -100);
    },
  },
  {
    id: 'fisher', params: { period: 10 }, expectedOutputs: 2, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][30] != null);
      assert.ok(outputs[1][30] != null);
    },
  },
  {
    id: 'kdj', params: { period: 9, k: 3, d: 3 }, expectedOutputs: 3, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][30] != null);
      assert.ok(outputs[1][30] != null);
      assert.ok(outputs[2][30] != null);
    },
  },
  {
    id: 'bollinger_percent_b', params: { period: 20, mult: 2 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'bollinger_bandwidth', params: { period: 20, mult: 2 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40]! >= 0);
    },
  },
  {
    id: 'chaikin_volatility', params: { period: 10, diff: 10 }, expectedOutputs: 1, expectedWarmup: 10,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'stddev', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40]! >= 0);
    },
  },
  {
    id: 'variance', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40]! >= 0);
    },
  },
  {
    id: 'adl', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][10] != null);
    },
  },
  {
    id: 'force_index', params: { period: 13 }, expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][30] != null);
    },
  },
  {
    id: 'eom', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][30] != null);
    },
  },
  {
    id: 'nvi', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][1] != null);
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'pvi', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][1] != null);
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'vpt', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][20] != null);
    },
  },
  {
    id: 'aroon_oscillator', params: { period: 25 }, expectedOutputs: 1, expectedWarmup: 24,
    validate(outputs) {
      const v = outputs[0][60]!;
      assert.ok(v <= 100 && v >= -100);
    },
  },
  {
    id: 'vortex', params: { period: 14 }, expectedOutputs: 2, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
      assert.ok(outputs[1][40] != null);
    },
  },
  {
    id: 'trima', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][50] != null);
    },
  },
  {
    id: 'smma', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 13,
    validate(outputs) {
      assert.ok(outputs[0][35] != null);
    },
  },
  {
    id: 'apo', params: { fast: 12, slow: 26 }, expectedOutputs: 1, expectedWarmup: 25,
    validate(outputs) {
      assert.ok(outputs[0][55] != null);
    },
  },
  {
    id: 'smi', params: { period: 14, smooth: 3, signal: 3 }, expectedOutputs: 2, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][50] != null);
      assert.ok(outputs[1][55] != null);
    },
  },
  {
    id: 'choppiness', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 13,
    validate(outputs) {
      const v = outputs[0][60]!;
      assert.ok(v >= 0 && Number.isFinite(v));
    },
  },
  {
    id: 'ulcer_index', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 13,
    validate(outputs) {
      assert.ok(outputs[0][50]! >= 0);
    },
  },
  {
    id: 'mass_index', params: { ema: 9, sum: 25 }, expectedOutputs: 1, expectedWarmup: 8,
    validate(outputs) {
      assert.ok(outputs[0][70] != null);
    },
  },
  {
    id: 'qstick', params: { period: 8 }, expectedOutputs: 1, expectedWarmup: 7,
    validate(outputs) {
      assert.ok(outputs[0][25] != null);
    },
  },
  {
    id: 'relative_volume', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40]! > 0);
    },
  },
  {
    id: 'balance_of_power', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][10] != null);
    },
  },
  {
    id: 'emv_osc', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][40] != null);
    },
  },
  {
    id: 'volatility_ratio', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 13,
    validate(outputs) {
      assert.ok(outputs[0][40]! >= 0);
    },
  },
  {
    id: 'linear_reg_slope', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][50] != null);
    },
  },
  {
    id: 'linear_reg_intercept', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][50] != null);
    },
  },
  {
    id: 'linear_reg_angle', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      const v = outputs[0][50]!;
      assert.ok(Number.isFinite(v));
    },
  },
  {
    id: 'price_channel_mid', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][50] != null);
    },
  },
  {
    id: 'median_price', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(closeTo(outputs[0][20], (high[20] + low[20]) / 2));
    },
  },
  {
    id: 'typical_price', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(closeTo(outputs[0][20], (high[20] + low[20] + close[20]) / 3));
    },
  },
  {
    id: 'weighted_close', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(closeTo(outputs[0][20], (high[20] + low[20] + 2 * close[20]) / 4));
    },
  },
  {
    id: 'volume_oscillator', params: { fast: 14, slow: 28 }, expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][60] != null);
    },
  },
  {
    id: 'coppock_curve', params: { roc1: 11, roc2: 14, wma: 10 }, expectedOutputs: 1, expectedWarmup: 23,
    validate(outputs) {
      assert.ok(outputs[0][60] != null);
    },
  },
  {
    id: 'percentile_rank', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      const v = outputs[0][40]!;
      assert.ok(v >= 0 && v <= 100);
    },
  },
  {
    id: 'normalized_atr', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 13,
    validate(outputs) {
      assert.ok(outputs[0][40]! >= 0);
    },
  },
  {
    id: 'price_channel_width', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40]! >= 0);
    },
  },
  {
    id: 'close_location_value', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      const v = outputs[0][10]!;
      assert.ok(v >= -1 && v <= 1);
    },
  },
  {
    id: 'candle_body', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(closeTo(outputs[0][5], close[5] - open[5]));
    },
  },
  {
    id: 'candle_body_percent', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(Number.isFinite(outputs[0][10]!));
    },
  },
  {
    id: 'upper_wick', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][10]! >= 0);
    },
  },
  {
    id: 'lower_wick', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][10]! >= 0);
    },
  },
  {
    id: 'true_range_percent', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][20]! >= 0);
    },
  },
  {
    id: 'rolling_high', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40]! >= outputs[0][39]!);
    },
  },
  {
    id: 'rolling_low', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][40]! <= high[40]);
    },
  },
  {
    id: 'volume_zscore', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(Number.isFinite(outputs[0][50]!));
    },
  },
  {
    id: 'volume_sma_ratio', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][50]! > 0);
    },
  },
  {
    id: 'range_sma_ratio', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][50]! > 0);
    },
  },
  {
    id: 'cumulative_volume_delta', expectedOutputs: 1, expectedWarmup: 0,
    validate(outputs) {
      assert.ok(outputs[0][1] != null);
    },
  },
  {
    id: 'rolling_return', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 20,
    validate(outputs) {
      assert.ok(Number.isFinite(outputs[0][60]!));
    },
  },
  {
    id: 'log_return', expectedOutputs: 1, expectedWarmup: 1,
    validate(outputs) {
      assert.ok(Number.isFinite(outputs[0][10]!));
    },
  },
  {
    id: 'volatility_ema', params: { period: 14 }, expectedOutputs: 1, expectedWarmup: 13,
    validate(outputs) {
      assert.ok(outputs[0][50]! >= 0);
    },
  },
  {
    id: 'breakout_strength', params: { period: 20 }, expectedOutputs: 1, expectedWarmup: 19,
    validate(outputs) {
      assert.ok(outputs[0][60]! >= 0 && outputs[0][60]! <= 100);
    },
  },
  {
    id: 'trend_strength', params: { fast: 12, slow: 26 }, expectedOutputs: 1, expectedWarmup: 25,
    validate(outputs) {
      assert.ok(Number.isFinite(outputs[0][60]!));
    },
  },
];

console.log('\nIndicators');

for (const tc of cases) {
  test(`${tc.id}: compute shape, warmup, deterministic`, () => {
    const def = getIndicator(tc.id);
    assert.ok(def, `missing definition: ${tc.id}`);

    const result = def!.compute({
      ...ctxBase,
      params: tc.params ?? {},
    });

    assert.equal(result.outputs.length, tc.expectedOutputs);
    for (const output of result.outputs) {
      assert.equal(output.length, n, `${tc.id} output length mismatch`);
    }

    const first = result.outputs[0];
    for (let i = 0; i < tc.expectedWarmup; i++) {
      assert.equal(first[i], null, `${tc.id} warmup expected null at ${i}`);
    }

    tc.validate(result.outputs);
  });
}

console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
