import assert from 'node:assert/strict';
import {
  brickTransform,
  kagiTransform,
  lineBreakTransform,
  pointFigureTransform,
  rangeBarsTransform,
  renkoTransform,
  type TransformOhlc,
} from '../src/transforms/premium.ts';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK  ${name}`);
  } catch (error) {
    console.error(`  FAIL  ${name}`);
    console.error(`      ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

const rows: TransformOhlc[] = Array.from({ length: 180 }, (_, i) => {
  const base = 100 + i * 0.18 + Math.sin(i * 0.17) * 1.6;
  const open = base + Math.sin(i * 0.08) * 0.4;
  const close = base + Math.cos(i * 0.11) * 0.6;
  const high = Math.max(open, close) + 0.8;
  const low = Math.min(open, close) - 0.7;
  return {
    time: 1_700_000_000 + i * 60,
    open,
    high,
    low,
    close,
    volume: 900 + i * 2,
  };
});

function assertValidOhlc(out: TransformOhlc[]): void {
  assert.ok(out.length > 0);
  for (let i = 0; i < out.length; i++) {
    const row = out[i];
    assert.ok(Number.isFinite(row.open));
    assert.ok(Number.isFinite(row.close));
    assert.ok(row.high >= Math.max(row.open, row.close));
    assert.ok(row.low <= Math.min(row.open, row.close));
    if (i > 0) {
      assert.ok(out[i].time >= out[i - 1].time);
    }
  }
}

test('renkoTransform emits valid OHLC bricks', () => {
  assertValidOhlc(renkoTransform(rows));
});

test('rangeBarsTransform emits valid OHLC range bars', () => {
  assertValidOhlc(rangeBarsTransform(rows));
});

test('lineBreakTransform emits valid OHLC line-break bars', () => {
  assertValidOhlc(lineBreakTransform(rows));
});

test('kagiTransform emits valid OHLC kagi bars', () => {
  assertValidOhlc(kagiTransform(rows));
});

test('pointFigureTransform emits valid OHLC point-figure bars', () => {
  assertValidOhlc(pointFigureTransform(rows));
});

test('brickTransform emits valid OHLC brick bars', () => {
  assertValidOhlc(brickTransform(rows));
});
