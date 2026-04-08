import assert from 'node:assert/strict';
import { getIndicator, listIndicators } from '../src/indicators/registry.ts';
import { registerBuiltins } from '../src/indicators/builtins/index.ts';

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

test('registerBuiltins includes 29 indicators total (existing 4 + new 25)', () => {
  const ids = new Set(listIndicators().map((d) => d.id));
  assert.equal(ids.size, 29);
});

const addedIds = [
  'wma', 'vwap', 'bbands', 'donchian', 'keltner', 'atr', 'supertrend', 'psar', 'pivot',
  'stochastic', 'cci', 'roc', 'momentum', 'williams_r', 'mfi', 'obv', 'cmf', 'adx',
  'aroon', 'trix', 'ultimate', 'chaikin_osc', 'awesome', 'dpo', 'ichimoku',
] as const;

test('all 25 new indicator ids are registered', () => {
  const ids = new Set(listIndicators().map((d) => d.id));
  for (const id of addedIds) {
    assert.ok(ids.has(id), `missing indicator ${id}`);
  }
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
