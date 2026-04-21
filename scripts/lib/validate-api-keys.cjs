#!/usr/bin/env node
/**
 * SEC-007: API Key Validity Monitor
 * Validates all configured external API keys by making a cheap real request.
 * Exits non-zero if any required key is invalid (breaks CI before deploy).
 *
 * Usage:
 *   node scripts/lib/validate-api-keys.cjs           # full check
 *   node scripts/lib/validate-api-keys.cjs --warn    # warn-only (exit 0)
 */
'use strict';
const fs = require('fs');
const path = require('path');

// Node 18+ has global fetch; fall back to node-fetch if present.
const _fetch = (typeof fetch === 'function') ? fetch :
  (() => { try { return require('node-fetch'); } catch { return null; } })();

if (!_fetch) {
  console.error('[validate-api-keys] fetch not available (Node <18 and node-fetch missing)');
  process.exit(2);
}

const WARN_ONLY = process.argv.includes('--warn');

const VALIDATORS = {
  alpha_vantage: {
    envVar: 'ALPHA_VANTAGE_KEY',
    required: false,
    async validate(key) {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=${encodeURIComponent(key)}`;
      const r = await _fetch(url);
      const j = await r.json().catch(() => ({}));
      if (j['Error Message']) return { valid: false, reason: j['Error Message'].slice(0, 120) };
      if (j['Information'] && /API key/i.test(j['Information'])) return { valid: false, reason: j['Information'].slice(0, 120) };
      if (j['Global Quote']) return { valid: true, reason: 'GLOBAL_QUOTE returned symbol data' };
      if (j['Note']) return { valid: true, reason: 'Rate limit note (key accepted)' };
      return { valid: false, reason: `unexpected: ${JSON.stringify(j).slice(0, 120)}` };
    },
  },
  fmp: {
    envVar: 'FMP_API_KEY',
    required: false,
    async validate(key) {
      const url = `https://financialmodelingprep.com/api/v3/quote-short/AAPL?apikey=${encodeURIComponent(key)}`;
      const r = await _fetch(url);
      if (r.status === 401 || r.status === 403) return { valid: false, reason: `HTTP ${r.status}` };
      const j = await r.json().catch(() => null);
      if (Array.isArray(j) && j.length > 0 && j[0].symbol) return { valid: true, reason: `AAPL quote returned` };
      if (j && j['Error Message']) return { valid: false, reason: j['Error Message'].slice(0, 120) };
      return { valid: false, reason: `unexpected response` };
    },
  },
  polygon: {
    envVar: 'POLYGON_API_KEY',
    required: false,
    async validate(key) {
      const url = `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apiKey=${encodeURIComponent(key)}`;
      const r = await _fetch(url);
      return { valid: r.status === 200, reason: `HTTP ${r.status}` };
    },
  },
};

async function main() {
  // Load .env if present
  try { require('dotenv').config(); } catch {}

  const results = {};
  let hardFail = false;

  for (const [name, cfg] of Object.entries(VALIDATORS)) {
    const key = process.env[cfg.envVar];
    if (!key || key.trim() === '') {
      results[name] = { valid: null, reason: `${cfg.envVar} not set` };
      if (cfg.required) hardFail = true;
      console.log(`[SKIP] ${name}: ${cfg.envVar} not set`);
      continue;
    }
    try {
      const r = await cfg.validate(key.trim());
      results[name] = r;
      if (r.valid) console.log(`[PASS] ${name}: ${r.reason}`);
      else {
        console.error(`[FAIL] ${name}: ${r.reason}`);
        if (cfg.required) hardFail = true;
      }
    } catch (e) {
      results[name] = { valid: false, reason: `exception: ${e.message}` };
      console.error(`[ERROR] ${name}: ${e.message}`);
      if (cfg.required) hardFail = true;
    }
  }

  const outDir = path.resolve(__dirname, '../../reports');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const outPath = path.join(outDir, 'api_key_validation.json');
  fs.writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    host: require('os').hostname(),
    results,
    hardFail,
  }, null, 2));
  console.log(`\nReport: ${outPath}`);

  if (hardFail && !WARN_ONLY) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(2); });
