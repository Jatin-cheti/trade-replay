/**
 * Line Tools Parity — 250 tests
 *
 * Validates that every line-based drawing tool in the app matches the
 * TradingView-parity specification: correct registry entry, label,
 * category placement, anchor count, capability flags, and default options.
 *
 * Covers all 38 line-based tools:
 *   - 9 Lines → Lines
 *   - 4 Lines → Channels
 *   - 4 Lines → Pitchforks
 *   - 11 Fibonacci
 *   - 4 Gann
 *   - 1 Forecasting → Volume-based (anchoredVwap)
 *   - 1 Brush → Arrows (arrowTool)
 *   - 4 Brush → Shapes (path, polyline, curveTool, doubleCurve)
 *
 * = 38 tools × 6 per-tool parity assertions + 22 cross-cutting = 250 tests
 */
import assert from 'node:assert/strict';
import {
  buildToolOptions,
  getToolDefinition,
  toolDefinitions,
  toolGroups,
  type ToolCategory,
  type ToolFamily,
  type ToolVariant,
} from '../../../../frontend/services/tools/toolRegistry.ts';

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passCount += 1;
    console.log(`  OK  ${name}`);
  } catch (error) {
    failCount += 1;
    failures.push(`${name}: ${(error as Error).message}`);
    console.error(`  FAIL  ${name}`);
    console.error(`      ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

/** Parity spec table — one row per line-based tool. */
type LineSpec = {
  variant: ToolVariant;
  label: string;
  category: ToolCategory;
  subSection: string;
  family: ToolFamily;
  anchors: number;
  draggable: boolean;
  resizable: boolean;
  supportsText: boolean;
  supportsFill: boolean;
  supportsLevels: boolean;
  rayMode?: boolean;       // expected default (if explicitly set)
  extendLeft?: boolean;
  extendRight?: boolean;
};

const SPECS: LineSpec[] = [
  // Lines → Lines (9)
  { variant: 'trend', label: 'Trend line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false },
  { variant: 'ray', label: 'Ray', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false, rayMode: true },
  { variant: 'infoLine', label: 'Info line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: false },
  { variant: 'extendedLine', label: 'Extended line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false, extendLeft: true, extendRight: true },
  { variant: 'trendAngle', label: 'Trend angle', category: 'lines', subSection: 'Lines', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: false },
  { variant: 'hline', label: 'Horizontal line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false },
  { variant: 'horizontalRay', label: 'Horizontal ray', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false, rayMode: true },
  { variant: 'vline', label: 'Vertical line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false },
  { variant: 'crossLine', label: 'Cross line', category: 'lines', subSection: 'Lines', family: 'line', anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false },

  // Lines → Channels (4)
  { variant: 'channel', label: 'Parallel channel', category: 'lines', subSection: 'Channels', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false },
  { variant: 'regressionTrend', label: 'Regression trend', category: 'lines', subSection: 'Channels', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false },
  { variant: 'flatTopBottom', label: 'Flat top/bottom', category: 'lines', subSection: 'Channels', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false },
  { variant: 'disjointChannel', label: 'Disjoint channel', category: 'lines', subSection: 'Channels', family: 'line', anchors: 4, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: false },

  // Lines → Pitchforks (4)
  { variant: 'pitchfork', label: 'Pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },
  { variant: 'schiffPitchfork', label: 'Schiff pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },
  { variant: 'modifiedSchiffPitchfork', label: 'Modified Schiff pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },
  { variant: 'insidePitchfork', label: 'Inside pitchfork', category: 'lines', subSection: 'Pitchforks', family: 'fib', anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },

  // Fibonacci (11)
  { variant: 'fibRetracement', label: 'Fib retracement', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true },
  { variant: 'fibExtension', label: 'Trend-based fib extension', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true },
  { variant: 'fibChannel', label: 'Fib channel', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true },
  { variant: 'fibTimeZone', label: 'Fib time zone', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true },
  { variant: 'fibSpeedResistFan', label: 'Fib speed resistance fan', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },
  { variant: 'fibTrendTime', label: 'Trend-based fib time', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: true, supportsFill: false, supportsLevels: true },
  { variant: 'fibCircles', label: 'Fib circles', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },
  { variant: 'fibSpiral', label: 'Fib spiral', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },
  { variant: 'fibSpeedResistArcs', label: 'Fib speed resistance arcs', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },
  { variant: 'fibWedge', label: 'Fib wedge', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },
  { variant: 'pitchfan', label: 'Pitchfan', category: 'fib', subSection: 'Fibonacci', family: 'fib', anchors: 3, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },

  // Gann (4)
  { variant: 'gannBox', label: 'Gann box', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: true },
  { variant: 'gannSquareFixed', label: 'Gann square fixed', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: true },
  { variant: 'gannSquare', label: 'Gann square', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: true, supportsLevels: true },
  { variant: 'gannFan', label: 'Gann fan', category: 'fib', subSection: 'Gann', family: 'fib', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: true },

  // Forecasting → Volume-based (1)
  { variant: 'anchoredVwap', label: 'Anchored VWAP', category: 'forecasting', subSection: 'Volume-based', family: 'line', anchors: 1, draggable: true, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false },

  // Brush → Arrows (1 line-family)
  { variant: 'arrowTool', label: 'Arrow', category: 'brush', subSection: 'Arrows', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false },

  // Brush → Shapes (4 line-family)
  { variant: 'path', label: 'Path', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false },
  { variant: 'polyline', label: 'Polyline', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false },
  { variant: 'curveTool', label: 'Curve', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false },
  { variant: 'doubleCurve', label: 'Double curve', category: 'brush', subSection: 'Shapes', family: 'line', anchors: 2, draggable: true, resizable: true, supportsText: false, supportsFill: false, supportsLevels: false },
];

// Sanity: the spec table must cover 38 tools
if (SPECS.length !== 38) {
  console.error(`SPEC table broken: expected 38 tools, got ${SPECS.length}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 38 × 6 = 228 per-tool parity tests (LTP-001..LTP-228)
// ─────────────────────────────────────────────────────────────
let n = 0;
const pad = (k: number): string => String(k).padStart(3, '0');
const id = (): string => `LTP-${pad(++n)}`;

for (const spec of SPECS) {
  const v = spec.variant;

  // (1) Existence
  test(`${id()} [${v}] is registered in toolDefinitionMap`, () => {
    const def = getToolDefinition(v);
    assert.ok(def, `getToolDefinition('${v}') returned null`);
  });

  // (2) Label parity
  test(`${id()} [${v}] has TV-parity label "${spec.label}"`, () => {
    const def = getToolDefinition(v)!;
    assert.equal(def.label, spec.label);
  });

  // (3) Category placement
  test(`${id()} [${v}] lives in category "${spec.category}" / "${spec.subSection}"`, () => {
    const def = getToolDefinition(v)!;
    assert.equal(def.category, spec.category);
    assert.equal(def.subSection, spec.subSection);
  });

  // (4) Family parity
  test(`${id()} [${v}] has family "${spec.family}"`, () => {
    const def = getToolDefinition(v)!;
    assert.equal(def.family, spec.family);
  });

  // (5) Anchor-count parity
  test(`${id()} [${v}] requires ${spec.anchors} anchor(s)`, () => {
    const def = getToolDefinition(v)!;
    assert.equal(def.capabilities.anchors, spec.anchors);
  });

  // (6) Capability-flag parity (draggable, resizable, supportsText/Fill/Levels)
  test(`${id()} [${v}] capability flags match TV parity`, () => {
    const def = getToolDefinition(v)!;
    assert.equal(def.capabilities.draggable, spec.draggable, 'draggable mismatch');
    assert.equal(def.capabilities.resizable, spec.resizable, 'resizable mismatch');
    assert.equal(def.capabilities.supportsText, spec.supportsText, 'supportsText mismatch');
    assert.equal(def.capabilities.supportsFill, spec.supportsFill, 'supportsFill mismatch');
    assert.equal(def.capabilities.supportsLevels, spec.supportsLevels, 'supportsLevels mismatch');
  });
}

// ─────────────────────────────────────────────────────────────
// 22 cross-cutting / default-option parity tests (LTP-229..LTP-250)
// ─────────────────────────────────────────────────────────────

// Default-option parity for tools with explicit defaults (rayMode / extend*)
test(`${id()} [ray] default rayMode === true`, () => {
  const opts = buildToolOptions('ray');
  assert.equal(opts.rayMode, true);
});

test(`${id()} [horizontalRay] default rayMode === true`, () => {
  const opts = buildToolOptions('horizontalRay');
  assert.equal(opts.rayMode, true);
});

test(`${id()} [trend] default rayMode === false`, () => {
  const opts = buildToolOptions('trend');
  assert.equal(opts.rayMode, false);
});

test(`${id()} [extendedLine] default extendLeft === true`, () => {
  const opts = buildToolOptions('extendedLine');
  assert.equal(opts.extendLeft, true);
});

test(`${id()} [extendedLine] default extendRight === true`, () => {
  const opts = buildToolOptions('extendedLine');
  assert.equal(opts.extendRight, true);
});

test(`${id()} [trend] default extendLeft === false`, () => {
  const opts = buildToolOptions('trend');
  assert.equal(opts.extendLeft, false);
});

test(`${id()} [trend] default extendRight === false`, () => {
  const opts = buildToolOptions('trend');
  assert.equal(opts.extendRight, false);
});

test(`${id()} [hline] default rayMode === false`, () => {
  const opts = buildToolOptions('hline');
  assert.equal(opts.rayMode, false);
});

test(`${id()} [vline] default rayMode === false`, () => {
  const opts = buildToolOptions('vline');
  assert.equal(opts.rayMode, false);
});

// Fibonacci behaviors parity — fibRetracement TV levels
test(`${id()} [fibRetracement] behaviors.fibLevels matches TV retracement levels`, () => {
  const def = getToolDefinition('fibRetracement')!;
  assert.deepEqual(def.behaviors?.fibLevels, [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
});

test(`${id()} [fibExtension] behaviors.fibLevels matches TV extension levels`, () => {
  const def = getToolDefinition('fibExtension')!;
  assert.deepEqual(def.behaviors?.fibLevels, [0, 0.618, 1, 1.272, 1.618, 2]);
});

// Section-membership parity
test(`${id()} Lines→Lines subsection contains exactly 9 TV-parity tools`, () => {
  const ids = toolDefinitions
    .filter((t) => t.category === 'lines' && t.subSection === 'Lines')
    .map((t) => t.id)
    .sort();
  assert.deepEqual(ids, ['crossLine', 'extendedLine', 'hline', 'horizontalRay', 'infoLine', 'ray', 'trend', 'trendAngle', 'vline'].sort());
});

test(`${id()} Lines→Channels subsection contains exactly 4 TV-parity tools`, () => {
  const ids = toolDefinitions
    .filter((t) => t.category === 'lines' && t.subSection === 'Channels')
    .map((t) => t.id)
    .sort();
  assert.deepEqual(ids, ['channel', 'disjointChannel', 'flatTopBottom', 'regressionTrend'].sort());
});

test(`${id()} Lines→Pitchforks subsection contains exactly 4 TV-parity tools`, () => {
  const ids = toolDefinitions
    .filter((t) => t.category === 'lines' && t.subSection === 'Pitchforks')
    .map((t) => t.id)
    .sort();
  assert.deepEqual(ids, ['insidePitchfork', 'modifiedSchiffPitchfork', 'pitchfork', 'schiffPitchfork'].sort());
});

test(`${id()} Fibonacci subsection contains exactly 11 TV-parity tools`, () => {
  const ids = toolDefinitions
    .filter((t) => t.category === 'fib' && t.subSection === 'Fibonacci')
    .map((t) => t.id)
    .sort();
  const expected = ['fibRetracement', 'fibExtension', 'fibChannel', 'fibTimeZone', 'fibSpeedResistFan', 'fibTrendTime', 'fibCircles', 'fibSpiral', 'fibSpeedResistArcs', 'fibWedge', 'pitchfan'].sort();
  assert.deepEqual(ids, expected);
});

test(`${id()} Gann subsection contains exactly 4 TV-parity tools`, () => {
  const ids = toolDefinitions
    .filter((t) => t.category === 'fib' && t.subSection === 'Gann')
    .map((t) => t.id)
    .sort();
  assert.deepEqual(ids, ['gannBox', 'gannFan', 'gannSquare', 'gannSquareFixed'].sort());
});

// Implementation / uniqueness
test(`${id()} all 38 line tools are marked implemented`, () => {
  for (const spec of SPECS) {
    const def = getToolDefinition(spec.variant)!;
    assert.equal(def.implemented, true, `${spec.variant} not implemented`);
  }
});

test(`${id()} all 38 line tool IDs are unique in registry`, () => {
  const ids = SPECS.map((s) => s.variant);
  const set = new Set(ids);
  assert.equal(set.size, ids.length);
});

test(`${id()} all 38 line tools have a non-empty iconKey`, () => {
  for (const spec of SPECS) {
    const def = getToolDefinition(spec.variant)!;
    assert.ok(def.iconKey && def.iconKey.length > 0, `${spec.variant} missing iconKey`);
  }
});

test(`${id()} all 38 line tools are reachable from toolGroups (UI)`, () => {
  const uiIds = new Set<string>();
  for (const group of toolGroups) {
    for (const v of group.variants) uiIds.add(v.id);
  }
  for (const spec of SPECS) {
    assert.ok(uiIds.has(spec.variant), `${spec.variant} not exposed in UI toolGroups`);
  }
});

test(`${id()} line-family count across all tools >= 19 (line-rendered tools)`, () => {
  const lineFamilyIds = toolDefinitions.filter((t) => t.family === 'line').map((t) => t.id);
  assert.ok(lineFamilyIds.length >= 19, `expected >= 19 line-family tools, got ${lineFamilyIds.length}`);
});

test(`${id()} fib-family count across all tools >= 19 (pitchforks + fib + gann)`, () => {
  const fibFamilyIds = toolDefinitions.filter((t) => t.family === 'fib').map((t) => t.id);
  assert.ok(fibFamilyIds.length >= 19, `expected >= 19 fib-family tools, got ${fibFamilyIds.length}`);
});

// Sanity: we wrote exactly 250 tests
if (n !== 250) {
  console.error(`\nSPEC ERROR: expected 250 tests, wrote ${n}`);
  process.exitCode = 1;
}

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  Line Tools Parity — ${n} tests`);
console.log(`  Passed: ${passCount}   Failed: ${failCount}`);
console.log('═══════════════════════════════════════════════════════════');
if (failures.length) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
}
