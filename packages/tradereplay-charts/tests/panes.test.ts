import assert from 'node:assert/strict';
import { computePaneLayout, resizePaneHeights } from '../src/lib/layout/panes.ts';

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

test('resizePaneHeights preserves total height and resizes adjacent panes', () => {
  const panes = [
    { id: 'main', height: 1 },
    { id: 'indicator', height: 1 },
    { id: 'volume', height: 1 },
  ];

  const before = computePaneLayout(panes, 600);
  const resized = resizePaneHeights(panes, 600, 0, 80, 48);
  const after = computePaneLayout(resized, 600);

  assert.equal(after.length, 3);
  assert.equal(after[0].h + after[1].h + after[2].h + 2 * 4, 600);
  assert.ok(after[0].h > before[0].h);
  assert.ok(after[1].h < before[1].h);
  assert.ok(Math.abs(after[2].h - before[2].h) <= 1);
});

test('resizePaneHeights clamps to minimum height', () => {
  const panes = [
    { id: 'main', height: 1 },
    { id: 'sub', height: 1 },
  ];

  const resized = resizePaneHeights(panes, 400, 0, -500, 48);
  const layout = computePaneLayout(resized, 400);

  assert.ok(layout[0].h >= 48);
  assert.ok(layout[1].h >= 48);
});
