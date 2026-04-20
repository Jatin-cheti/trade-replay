#!/usr/bin/env node
/**
 * Generate tool coverage report.
 *
 * Usage (run after tool-matrix.spec.ts has executed):
 *   node tests/tooling/generate-coverage.mjs
 *
 * Reads:
 *   artifacts/matrix-results.json   (written by tool-matrix.spec.ts afterAll)
 *   artifacts/tool-inventory.json   (written by generate-inventory.mjs)
 *
 * Writes:
 *   artifacts/tool-coverage.json
 *   artifacts/tool-coverage.html
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const ARTIFACTS_DIR = resolve(ROOT, 'artifacts');

// ─────────────────────────────────────────────────────────────────────────────
// Load inputs
// ─────────────────────────────────────────────────────────────────────────────

function loadJson(filePath, label) {
  if (!existsSync(filePath)) {
    console.warn(`⚠️  ${label} not found at ${filePath} — skipping`);
    return null;
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

const matrixResults = loadJson(resolve(ARTIFACTS_DIR, 'matrix-results.json'), 'matrix-results.json');
const toolInventory = loadJson(resolve(ARTIFACTS_DIR, 'tool-inventory.json'), 'tool-inventory.json');

if (!matrixResults || !toolInventory) {
  console.error('❌ Missing input files. Run generate-inventory.mjs and tool-matrix.spec.ts first.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute coverage
// ─────────────────────────────────────────────────────────────────────────────

const allResults = matrixResults.results ?? [];
const smokeResults = allResults.filter(r => r.scenario === 'smoke');
const testedToolIds = new Set(smokeResults.map(r => r.toolId));
const passedToolIds = new Set(smokeResults.filter(r => r.passed).map(r => r.toolId));
const failedToolIds = new Set(smokeResults.filter(r => !r.passed).map(r => r.toolId));

const allDrawingTools = toolInventory.leftToolbar ?? [];
const drawableTools = allDrawingTools.filter(t =>
  !['image', 'post', 'idea', 'emoji', 'sticker', 'iconTool'].includes(t.toolId)
);

const testedCount = testedToolIds.size;
const passedCount = passedToolIds.size;
const failedCount = failedToolIds.size;
const notTestedCount = drawableTools.filter(t => !testedToolIds.has(t.toolId)).length;
const coveragePercent = drawableTools.length > 0
  ? ((testedCount / drawableTools.length) * 100).toFixed(1)
  : '0.0';
const passRatePercent = testedCount > 0
  ? ((passedCount / testedCount) * 100).toFixed(1)
  : '0.0';

// Per-category breakdown
const CATEGORIES = ['lines', 'fib', 'patterns', 'forecasting', 'brush', 'text'];
const categoryBreakdown = CATEGORIES.map(cat => {
  const catTools = drawableTools.filter(t => t.category === cat);
  const catTested = catTools.filter(t => testedToolIds.has(t.toolId));
  const catPassed = catTools.filter(t => passedToolIds.has(t.toolId));
  const catFailed = catTools.filter(t => failedToolIds.has(t.toolId));
  const catNotTested = catTools.filter(t => !testedToolIds.has(t.toolId));
  return {
    category: cat,
    total: catTools.length,
    tested: catTested.length,
    passed: catPassed.length,
    failed: catFailed.length,
    notTested: catNotTested.length,
    coveragePct: catTools.length > 0 ? ((catTested.length / catTools.length) * 100).toFixed(1) : '0.0',
    passRatePct: catTested.length > 0 ? ((catPassed.length / catTested.length) * 100).toFixed(1) : '0.0',
    failedTools: catFailed.map(t => ({
      toolId: t.toolId,
      toolName: t.toolName,
      error: smokeResults.find(r => r.toolId === t.toolId)?.error ?? 'draw failed',
    })),
  };
});

// Option coverage
const optionResults = allResults.filter(r => r.scenario === 'option' && r.optionId);
const optionTestedIds = [...new Set(optionResults.map(r => r.toolId))];

function optionValueKey(toolId, optionId, optionValue) {
  return `${toolId}|${optionId}|${JSON.stringify(optionValue)}`;
}

const optionInventoryKeys = new Set();
drawableTools.forEach(tool => {
  (tool.options ?? []).forEach(option => {
    (option.values ?? []).forEach(value => {
      optionInventoryKeys.add(optionValueKey(tool.toolId, option.optionId, value.value));
    });
  });
});

const testedOptionKeys = new Set(
  optionResults.map(r => optionValueKey(r.toolId, r.optionId, r.optionValue)),
);
const passedOptionKeys = new Set(
  optionResults
    .filter(r => r.passed)
    .map(r => optionValueKey(r.toolId, r.optionId, r.optionValue)),
);

const totalOptionValueCombos = optionInventoryKeys.size;
const testedOptionValueCombos = testedOptionKeys.size;
const passedOptionValueCombos = passedOptionKeys.size;
const optionCoveragePercent = totalOptionValueCombos > 0
  ? ((testedOptionValueCombos / totalOptionValueCombos) * 100).toFixed(1)
  : '0.0';
const optionPassRatePercent = testedOptionValueCombos > 0
  ? ((passedOptionValueCombos / testedOptionValueCombos) * 100).toFixed(1)
  : '0.0';

// Header coverage
const headerResults = allResults.filter(r => r.scenario === 'header');

// Multi-5 coverage
const multi5Results = allResults.filter(r => r.scenario === 'multi-5');

// Fullscreen coverage
const fullscreenResults = allResults.filter(r => r.scenario === 'fullscreen');

// ─────────────────────────────────────────────────────────────────────────────
// Build JSON coverage report
// ─────────────────────────────────────────────────────────────────────────────

const coverage = {
  generatedAt: new Date().toISOString(),
  matrixRanAt: matrixResults.generatedAt,
  summary: {
    totalDrawableTools: drawableTools.length,
    testedTools: testedCount,
    passedTools: passedCount,
    failedTools: failedCount,
    notTestedTools: notTestedCount,
    coveragePercent: parseFloat(coveragePercent),
    passRatePercent: parseFloat(passRatePercent),
    overallPassed: matrixResults.summary?.passed ?? passedCount,
    overallFailed: matrixResults.summary?.failed ?? failedCount,
  },
  byScenario: matrixResults.byScenario,
  byCategory: categoryBreakdown,
  optionCoverage: {
    testedTools: optionTestedIds.length,
    totalOptionTests: optionResults.length,
    passedOptionTests: optionResults.filter(r => r.passed).length,
    totalOptionValueCombos,
    testedOptionValueCombos,
    passedOptionValueCombos,
    coveragePercent: parseFloat(optionCoveragePercent),
    passRatePercent: parseFloat(optionPassRatePercent),
  },
  headerCoverage: {
    totalTests: headerResults.length,
    passed: headerResults.filter(r => r.passed).length,
  },
  fullscreenCoverage: {
    totalTests: fullscreenResults.length,
    passed: fullscreenResults.filter(r => r.passed).length,
  },
  multiObjectCoverage: {
    totalTests: multi5Results.length,
    passed: multi5Results.filter(r => r.passed).length,
  },
  notTestedTools: drawableTools
    .filter(t => !testedToolIds.has(t.toolId))
    .map(t => ({ toolId: t.toolId, toolName: t.toolName, category: t.category })),
  failedToolsDetail: drawableTools
    .filter(t => failedToolIds.has(t.toolId))
    .map(t => ({
      toolId: t.toolId,
      toolName: t.toolName,
      category: t.category,
      error: smokeResults.find(r => r.toolId === t.toolId)?.error ?? 'unknown',
    })),
};

// ─────────────────────────────────────────────────────────────────────────────
// Build HTML coverage report
// ─────────────────────────────────────────────────────────────────────────────

function statusBadge(passed, failed, total) {
  const pct = total > 0 ? ((passed / total) * 100).toFixed(0) : 0;
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';
  return `<span style="background:${color};color:#fff;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:700">${pct}% (${passed}/${total})</span>`;
}

function renderToolRow(tool) {
  const smoke = smokeResults.find(r => r.toolId === tool.toolId);
  const status = smoke
    ? (smoke.passed ? '✅' : '❌')
    : '⬜️';
  const err = smoke?.error ?? '';
  const dur = smoke ? `${smoke.durationMs}ms` : '—';
  const rowClass = smoke ? (smoke.passed ? '' : 'style="background:#fef2f2"') : 'style="background:#f8fafc"';
  return `
    <tr ${rowClass}>
      <td style="padding:6px 8px;font-family:monospace;font-size:12px">${status} ${tool.toolId}</td>
      <td style="padding:6px 8px;color:#666;font-size:12px">${tool.toolName}</td>
      <td style="padding:6px 8px;font-size:12px">${tool.family ?? '—'}</td>
      <td style="padding:6px 8px;font-size:12px">${tool.anchorCount ?? '—'}</td>
      <td style="padding:6px 8px;font-size:12px;color:#ef4444">${err ? err.slice(0, 80) : ''}</td>
      <td style="padding:6px 8px;font-size:12px;color:#888">${dur}</td>
    </tr>`;
}

function renderCategoryTable(cat, catTools) {
  return `
  <h3 style="margin:20px 0 8px;color:#1e40af;text-transform:capitalize">${cat}</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="text-align:left;padding:6px 8px;font-size:12px;color:#475569">Tool ID</th>
        <th style="text-align:left;padding:6px 8px;font-size:12px;color:#475569">Name</th>
        <th style="text-align:left;padding:6px 8px;font-size:12px;color:#475569">Family</th>
        <th style="text-align:left;padding:6px 8px;font-size:12px;color:#475569">Anchors</th>
        <th style="text-align:left;padding:6px 8px;font-size:12px;color:#475569">Error</th>
        <th style="text-align:left;padding:6px 8px;font-size:12px;color:#475569">Duration</th>
      </tr>
    </thead>
    <tbody>
      ${catTools.map(renderToolRow).join('')}
    </tbody>
  </table>`;
}

const overallPct = parseFloat(passRatePercent);
const overallColor = overallPct >= 90 ? '#22c55e' : overallPct >= 70 ? '#f59e0b' : '#ef4444';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tool Coverage Report — Phase 1</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; margin-bottom: 4px; }
    .header p { color: #94a3b8; font-size: 14px; }
    .score { font-size: 64px; font-weight: 900; color: ${overallColor}; margin: 8px 0; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: white; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0; }
    .stat-card .value { font-size: 28px; font-weight: 700; }
    .stat-card .label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .stat-card.green .value { color: #22c55e; }
    .stat-card.red .value { color: #ef4444; }
    .stat-card.yellow .value { color: #f59e0b; }
    .stat-card.blue .value { color: #3b82f6; }
    .section { background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
    .section h2 { font-size: 18px; margin-bottom: 16px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .cat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .cat-card { border-radius: 8px; padding: 14px; border: 1px solid #e2e8f0; }
    .cat-card h4 { font-size: 14px; font-weight: 700; text-transform: capitalize; margin-bottom: 8px; }
    .bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 6px 0; }
    .bar-fill { height: 100%; border-radius: 4px; }
    .scenario-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .scenario-row:last-child { border-bottom: none; }
    .scenario-name { font-weight: 600; font-size: 14px; }
    table tr:hover { background: #f8fafc !important; }
    .badge-success { background: #dcfce7; color: #166534; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
    .badge-fail { background: #fee2e2; color: #991b1b; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
    .badge-skip { background: #f1f5f9; color: #475569; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛠️ Tool Coverage Report — Phase 1</h1>
      <p>Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Matrix ran: ${matrixResults.generatedAt ?? '—'}</p>
      <div class="score">${passRatePercent}%</div>
      <div style="color:#94a3b8;font-size:14px">${passedCount}/${testedCount} tools passing &nbsp;·&nbsp; ${coveragePercent}% of ${drawableTools.length} tools covered</div>
    </div>

    <div class="stat-grid">
      <div class="stat-card green">
        <div class="value">${passedCount}</div>
        <div class="label">Tools Passing</div>
      </div>
      <div class="stat-card red">
        <div class="value">${failedCount}</div>
        <div class="label">Tools Failing</div>
      </div>
      <div class="stat-card yellow">
        <div class="value">${notTestedCount}</div>
        <div class="label">Not Tested</div>
      </div>
      <div class="stat-card blue">
        <div class="value">${testedCount}</div>
        <div class="label">Tested (${coveragePercent}%)</div>
      </div>
      <div class="stat-card">
        <div class="value">${allResults.length}</div>
        <div class="label">Total Test Cases</div>
      </div>
      <div class="stat-card">
        <div class="value">${matrixResults.summary?.totalDurationMs ? (matrixResults.summary.totalDurationMs / 1000).toFixed(0) + 's' : '—'}</div>
        <div class="label">Total Duration</div>
      </div>
    </div>

    <div class="section">
      <h2>Scenario Breakdown</h2>
      ${['smoke', 'multi-5', 'fullscreen', 'option', 'header', 'mixed'].map(sc => {
        const s = matrixResults.byScenario?.[sc] ?? { total: 0, passed: 0, failed: 0 };
        const pct = s.total > 0 ? ((s.passed / s.total) * 100).toFixed(0) : 0;
        const badgeClass = pct >= 90 ? 'badge-success' : pct > 0 ? 'badge-fail' : 'badge-skip';
        return `
        <div class="scenario-row">
          <div class="scenario-name">[${sc}]</div>
          <div>
            <span class="${badgeClass}">${pct}% &nbsp; ${s.passed}/${s.total}</span>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="section">
      <h2>Category Coverage</h2>
      <div class="cat-grid">
        ${categoryBreakdown.map(cat => {
          const passColor = parseFloat(cat.passRatePct) >= 90 ? '#22c55e' : parseFloat(cat.passRatePct) >= 70 ? '#f59e0b' : '#ef4444';
          return `
          <div class="cat-card">
            <h4>${cat.category} (${cat.total} tools)</h4>
            <div class="bar"><div class="bar-fill" style="width:${cat.coveragePct}%;background:#3b82f6"></div></div>
            <div style="font-size:12px;color:#64748b;margin-bottom:4px">Coverage: ${cat.coveragePct}% (${cat.tested}/${cat.total})</div>
            <div class="bar"><div class="bar-fill" style="width:${cat.passRatePct}%;background:${passColor}"></div></div>
            <div style="font-size:12px;color:#64748b">Pass rate: <strong style="color:${passColor}">${cat.passRatePct}%</strong> (${cat.passed}/${cat.tested})</div>
            ${cat.failed > 0 ? `<div style="font-size:11px;color:#ef4444;margin-top:4px">Failed: ${cat.failedTools.map(t => t.toolId).join(', ')}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="section">
      <h2>Tool-by-Tool Results</h2>
      ${CATEGORIES.map(cat => {
        const catTools = drawableTools.filter(t => t.category === cat);
        return renderCategoryTable(cat, catTools);
      }).join('')}
    </div>

    ${coverage.failedToolsDetail.length > 0 ? `
    <div class="section">
      <h2>❌ Failed Tools — Action Required</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#fef2f2">
            <th style="text-align:left;padding:8px;font-size:13px">Tool ID</th>
            <th style="text-align:left;padding:8px;font-size:13px">Category</th>
            <th style="text-align:left;padding:8px;font-size:13px">Error</th>
          </tr>
        </thead>
        <tbody>
          ${coverage.failedToolsDetail.map(t => `
          <tr style="border-bottom:1px solid #fecaca">
            <td style="padding:8px;font-family:monospace;font-size:12px;font-weight:700">${t.toolId}</td>
            <td style="padding:8px;font-size:12px">${t.category}</td>
            <td style="padding:8px;font-size:12px;color:#dc2626">${t.error}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="section" style="background:#f0fdf4;border-color:#86efac">
      <h2 style="color:#166534">🎉 All Tested Tools Passing!</h2>
      <p style="color:#15803d;margin-top:8px">No failures detected. Phase 1 is green.</p>
    </div>`}

    ${notTestedCount > 0 ? `
    <div class="section">
      <h2>⬜️ Not Yet Tested (${notTestedCount} tools)</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${coverage.notTestedTools.map(t => `
        <span style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:4px 10px;font-size:12px;font-family:monospace">${t.toolId}</span>`).join('')}
      </div>
    </div>` : ''}

    <div style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;padding:16px">
      Phase 1 Tool Coverage Report &nbsp;·&nbsp; trade-replay-custom-charts &nbsp;·&nbsp; ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// Write outputs
// ─────────────────────────────────────────────────────────────────────────────


mkdirSync(ARTIFACTS_DIR, { recursive: true });
writeFileSync(resolve(ARTIFACTS_DIR, 'tool-coverage.json'), JSON.stringify(coverage, null, 2), 'utf8');
writeFileSync(resolve(ARTIFACTS_DIR, 'tool-coverage.html'), html, 'utf8');

console.log('');
console.log('📊 TOOL COVERAGE REPORT');
console.log('========================');
console.log(`  Coverage:   ${coveragePercent}% (${testedCount}/${drawableTools.length} tools tested)`);
console.log(`  Pass rate:  ${passRatePercent}% (${passedCount}/${testedCount} tools passing)`);
console.log(`  Option val: ${optionCoveragePercent}% (${testedOptionValueCombos}/${totalOptionValueCombos} combos tested)`);
console.log(`  Option pass:${optionPassRatePercent}% (${passedOptionValueCombos}/${testedOptionValueCombos || 0} combos passing)`);
console.log(`  Failures:   ${failedCount}`);
console.log(`  Not tested: ${notTestedCount}`);
console.log('');
categoryBreakdown.forEach(cat => {
  const icon = parseFloat(cat.passRatePct) >= 90 ? '✅' : parseFloat(cat.passRatePct) >= 70 ? '⚠️' : '❌';
  console.log(`  ${icon} ${cat.category.padEnd(12)} ${cat.passRatePct.padStart(5)}% pass (${cat.passed}/${cat.tested} tested)`);
});
console.log('');
if (coverage.failedToolsDetail.length > 0) {
  console.log('❌ Failed tools:');
  coverage.failedToolsDetail.forEach(t => {
    console.log(`   - ${t.toolId} (${t.category}): ${t.error}`);
  });
  console.log('');
}
console.log(`✅ Wrote: artifacts/tool-coverage.json`);
console.log(`✅ Wrote: artifacts/tool-coverage.html`);
