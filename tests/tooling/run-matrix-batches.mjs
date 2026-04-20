#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const ARTIFACTS_DIR = resolve(ROOT, 'artifacts');
const MATRIX_RESULTS_PATH = resolve(ARTIFACTS_DIR, 'matrix-results.json');
const TOOL_INVENTORY_PATH = resolve(ARTIFACTS_DIR, 'tool-inventory.json');
const PLAYWRIGHT_CLI = resolve(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

const NODE = process.execPath;

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      ...env,
    },
  });

  if (result.status !== 0) {
    const rendered = [command, ...args].join(' ');
    const detail = result.error ? ` (${result.error.message})` : '';
    throw new Error(`Command failed (${result.status}): ${rendered}${detail}`);
  }
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function summarizeProgress(label) {
  if (!existsSync(MATRIX_RESULTS_PATH)) {
    console.log(`[${label}] matrix-results.json not written yet`);
    return;
  }
  const matrix = loadJson(MATRIX_RESULTS_PATH);
  const smoke = matrix?.byScenario?.smoke ?? { total: 0, passed: 0, failed: 0 };
  const option = matrix?.byScenario?.option ?? { total: 0, passed: 0, failed: 0 };
  console.log(
    `[${label}] smoke ${smoke.passed}/${smoke.total} passed, option ${option.passed}/${option.total} passed, summary ${matrix?.summary?.passed ?? 0}/${matrix?.summary?.total ?? 0}`,
  );
}

if (!existsSync(TOOL_INVENTORY_PATH)) {
  run(NODE, [resolve(ROOT, 'tests/tooling/generate-inventory.mjs')]);
}

const inventory = loadJson(TOOL_INVENTORY_PATH);
const drawableTools = (inventory.leftToolbar ?? []).filter(
  (tool) => !['image', 'post', 'idea', 'emoji', 'sticker', 'iconTool'].includes(tool.toolId),
);

const familyOrder = ['line', 'fib', 'pattern', 'position', 'shape', 'measure', 'text'];
const smokeBatches = familyOrder
  .map((family) => ({
    name: `smoke:${family}`,
    scenario: 'smoke',
    toolIds: drawableTools.filter((tool) => tool.family === family).map((tool) => tool.toolId),
  }))
  .filter((batch) => batch.toolIds.length > 0);

const optionBatches = familyOrder
  .map((family) => ({
    name: `option:${family}`,
    scenario: 'option',
    toolIds: drawableTools.filter((tool) => tool.family === family).map((tool) => tool.toolId),
  }))
  .filter((batch) => batch.toolIds.length > 0);

const allBatches = [...smokeBatches, ...optionBatches];

const RESET_MATRIX = process.env.MATRIX_RESET !== '0';
const START_AT = process.env.MATRIX_START_AT;

let startIndex = 0;
if (START_AT) {
  startIndex = allBatches.findIndex((batch) => batch.name === START_AT);
  if (startIndex === -1) {
    throw new Error(`Unknown MATRIX_START_AT batch: ${START_AT}`);
  }
}

const batchesToRun = allBatches.slice(startIndex);

if (RESET_MATRIX && existsSync(MATRIX_RESULTS_PATH)) {
  rmSync(MATRIX_RESULTS_PATH, { force: true });
}

if (!RESET_MATRIX && existsSync(MATRIX_RESULTS_PATH)) {
  summarizeProgress('resume-base');
}

console.log(`Running ${batchesToRun.length} matrix batches from ${ROOT}`);

for (const batch of batchesToRun) {
  console.log(`\n=== Batch ${batch.name} (${batch.toolIds.length} tools) ===`);

  run(
    NODE,
    [
      PLAYWRIGHT_CLI,
      'test',
      '--config=tests/integration/e2e/playwright.config.ts',
      '--project=chromium',
      'tests/integration/e2e/tool-matrix.spec.ts',
    ],
    {
      MATRIX_SCENARIOS: batch.scenario,
      MATRIX_TOOL_IDS: batch.toolIds.join(','),
      MATRIX_ACCUMULATE: '1',
    },
  );

  run(NODE, [resolve(ROOT, 'tests/tooling/generate-coverage.mjs')]);
  summarizeProgress(batch.name);
}

console.log('\n=== Final coverage generation ===');
run(NODE, [resolve(ROOT, 'tests/tooling/generate-coverage.mjs')]);
summarizeProgress('final');

console.log('\nMatrix batching complete.');
