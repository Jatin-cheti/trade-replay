import assert from 'node:assert/strict';
import { padPriceRange, priceToY, yToPrice, sepPriceToY, sepYToPrice } from '../src/lib/scales/priceScale.ts';

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

test('priceToY and yToPrice round-trip within one screen pixel', () => {
  const paneTop = 12;
  const paneH = 240;
  const min = 90;
  const max = 110;

  for (const price of [90, 95, 100, 105, 110]) {
    const y = priceToY(price, min, max, paneTop, paneH);
    const resolved = yToPrice(y, min, max, paneTop, paneH);
    assert.ok(Math.abs(resolved - price) < 1e-9);
  }
});

test('separate scale helpers round-trip with margins', () => {
  const paneTop = 8;
  const paneH = 300;
  const min = 200;
  const max = 260;
  const scaleMargins = { top: 0.15, bottom: 0.1 };

  for (const price of [200, 220, 240, 260]) {
    const y = sepPriceToY(price, min, max, scaleMargins, paneTop, paneH);
    const resolved = sepYToPrice(y, min, max, scaleMargins, paneTop, paneH);
    assert.ok(Math.abs(resolved - price) < 1e-9);
  }
});

test('padPriceRange adds symmetric autoscale padding and widens flat ranges', () => {
  const padded = padPriceRange(100, 120, 0.1);
  assert.equal(padded.min, 98);
  assert.equal(padded.max, 122);

  const flat = padPriceRange(42, 42, 0.1);
  assert.ok(flat.min < 42);
  assert.ok(flat.max > 42);
  assert.equal(Number((flat.max - flat.min).toFixed(6)), 2.4);
});