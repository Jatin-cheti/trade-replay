// scripts/logo-waterfall.cjs
// Zero-fallback logo enrichment — 7 real providers, HTTP-verified before DB write
// Usage: node scripts/logo-waterfall.cjs  (run from /opt/tradereplay/services/screener-service)
'use strict';

const { MongoClient } = require('mongodb');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI_PRODUCTION || process.env.MONGODB_URI || 'mongodb://10.122.0.2:27017/tradereplay';
const TOP_N = Number(process.env.TOP_N || 10000);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 20);
const DELAY_BETWEEN_BATCHES = Number(process.env.DELAY_MS || 200);
const HTTP_TIMEOUT = 6000;
const SKIP_ALREADY_GOOD = (process.env.SKIP_ALREADY_GOOD || '1') !== '0';

const STATS_DIR = '/opt/tradereplay/logs';
try { fs.mkdirSync(STATS_DIR, { recursive: true }); } catch(_) {}

// Dead URLs we must overwrite
const DEAD = /clearbit|img\.logo\.dev|ui-avatars|logo\.uplead/i;

// ── Domain derivation ──
function deriveDomainsFromName(name) {
  if (!name) return [];
  const suffixes = [
    'limited','ltd','inc','corp','corporation','co','pvt','plc','llc','sa','ag','nv','se','ab','oyj',
    'group','holdings','holding','industries','industry','enterprises','enterprise',
    'technologies','technology','tech','solutions','solution','services','service',
    'bank','financial','finance','capital','energy','power','steel','cement',
    'pharma','pharmaceuticals','chemicals','chemical','foods','food','beverages',
    'motors','automotive','infrastructure','constructions','realty','estate',
    'retail','logistics','telecom','communications','media',
    'international','national','global','india','indian','company'
  ];
  let clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  for (const s of suffixes) clean = clean.replace(new RegExp(`\\s+${s}\\s*$`), '').trim();
  const slug = clean.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  const dash = clean.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  if (!slug || slug.length < 3) return [];
  const out = new Set();
  for (const tld of ['.com', '.in', '.co.in', '.net', '.org', '.io']) out.add(slug + tld);
  if (dash !== slug) for (const tld of ['.com', '.in']) out.add(dash + tld);
  return Array.from(out);
}

function check(url, timeout = HTTP_TIMEOUT) {
  return new Promise(res => {
    if (!url || !url.startsWith('http')) return res({ ok:false, status:0 });
    const lib = url.startsWith('https') ? https : http;
    let done = false;
    const req = lib.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0 LogoWaterfall/1.0' } }, r => {
      if (done) return; done = true;
      const ok = r.statusCode === 200 || r.statusCode === 301 || r.statusCode === 302;
      res({ ok, status: r.statusCode });
      r.resume();
    });
    req.on('error', () => { if (!done) { done=true; res({ ok:false, status:-1 }); } });
    req.on('timeout', () => { if (!done) { done=true; req.destroy(); res({ ok:false, status:-2 }); } });
    setTimeout(() => { if (!done) { done=true; try{req.destroy();}catch(_){}; res({ ok:false, status:-3 }); } }, timeout + 500);
  });
}

async function getLogoUrl(sym) {
  const { symbol, tickerSymbol, name, exchange, country, websiteUrl, companyDomain, s3Icon, fmpIcon, iconUrl } = sym;
  const ticker = (tickerSymbol || symbol || '').replace(/[^A-Za-z0-9.\-]/g, '');

  // 1. S3 own CDN
  if (s3Icon && s3Icon.startsWith('http')) {
    const r = await check(s3Icon);
    if (r.ok) return { url: s3Icon, provider: 's3_own', quality: 10 };
  }

  // 2. FMP image-stock (prior value if not dead)
  if (iconUrl && iconUrl.includes('financialmodelingprep.com/image-stock') && !DEAD.test(iconUrl)) {
    const r = await check(iconUrl);
    if (r.ok) return { url: iconUrl, provider: 'fmp_existing', quality: 9 };
  }

  // 3. FMP image-stock (try ticker variants)
  if (ticker) {
    const variants = [ticker];
    if (country === 'IN' || exchange === 'NSE') variants.push(ticker + '.NS');
    if (country === 'IN' || exchange === 'BSE') variants.push(ticker + '.BO');
    for (const t of variants) {
      const u = `https://financialmodelingprep.com/image-stock/${encodeURIComponent(t)}.png`;
      const r = await check(u);
      if (r.ok) return { url: u, provider: 'fmp', quality: 9 };
    }
  }

  // Build domain candidates
  const domains = [];
  if (companyDomain) domains.push(companyDomain.replace(/^https?:\/\//i,'').replace(/^www\./,'').split('/')[0]);
  if (websiteUrl) {
    try {
      const u = new URL(websiteUrl.startsWith('http') ? websiteUrl : 'https://'+websiteUrl);
      domains.push(u.hostname.replace(/^www\./, ''));
    } catch(_) {
      const s = websiteUrl.replace(/^https?:\/\//i,'').replace(/^www\./i,'').split('/')[0];
      if (s) domains.push(s);
    }
  }
  domains.push(...deriveDomainsFromName(name));
  const uniqueDomains = Array.from(new Set(domains.filter(d => d && d.length >= 4))).slice(0, 6);

  // 4. DuckDuckGo favicons
  for (const d of uniqueDomains) {
    const u = `https://icons.duckduckgo.com/ip3/${d}.ico`;
    const r = await check(u);
    if (r.ok) return { url: u, provider: 'duckduckgo', quality: 7 };
  }

  // 5. Google favicons
  for (const d of uniqueDomains.slice(0, 4)) {
    const u = `https://www.google.com/s2/favicons?sz=128&domain=${d}`;
    const r = await check(u);
    if (r.ok) return { url: u, provider: 'google_favicons', quality: 6 };
  }

  // 6. Direct favicon.ico
  for (const d of uniqueDomains.slice(0, 3)) {
    const u = `https://${d}/favicon.ico`;
    const r = await check(u);
    if (r.ok) return { url: u, provider: 'direct_favicon', quality: 5 };
  }

  return null;
}

async function main() {
  console.log('=== LOGO WATERFALL START ===', new Date().toISOString());
  console.log('TOP_N=' + TOP_N + ' BATCH=' + BATCH_SIZE + ' URI=' + MONGO_URI.replace(/:\/\/[^@]+@/, '://***@'));
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const col = client.db().collection('cleanassets');

  const query = SKIP_ALREADY_GOOD
    ? { type: 'stock', $or: [
        { iconUrl: null },
        { iconUrl: '' },
        { iconUrl: { $exists: false } },
        { iconUrl: /clearbit/ },
        { iconUrl: /logo\.dev/ },
        { iconUrl: /ui-avatars/ },
        { iconUrl: /logo\.uplead/ },
        { logoVerified: { $ne: true } }
      ] }
    : { type: 'stock' };

  const total = await col.countDocuments(query);
  console.log('Matches needing work:', total);

  const cursor = col.find(query)
    .sort({ marketCap: -1 })
    .limit(TOP_N)
    .project({ _id:1, symbol:1, tickerSymbol:1, name:1, exchange:1, country:1, websiteUrl:1, companyDomain:1, s3Icon:1, fmpIcon:1, iconUrl:1, marketCap:1 });

  const symbols = await cursor.toArray();
  console.log('Processing:', symbols.length);

  const stats = { processed:0, enriched:0, failed:0, byProvider:{}, failedSymbols:[] };
  const start = Date.now();

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async sym => {
      try {
        const result = await getLogoUrl(sym);
        stats.processed++;
        if (result) {
          await col.updateOne(
            { _id: sym._id },
            { $set: {
                iconUrl: result.url,
                logoProvider: result.provider,
                logoQuality: result.quality,
                logoVerified: true,
                logoVerifiedAt: new Date()
              }
            }
          );
          // Also fan out: update all rows with same ticker symbol + country (CFD/BSE/NSE duplicates)
          if (sym.symbol && sym.country) {
            await col.updateMany(
              { symbol: sym.symbol, country: sym.country, _id: { $ne: sym._id } },
              { $set: {
                  iconUrl: result.url,
                  logoProvider: result.provider + '_fanout',
                  logoQuality: result.quality,
                  logoVerified: true,
                  logoVerifiedAt: new Date()
                }
              }
            );
          }
          stats.enriched++;
          stats.byProvider[result.provider] = (stats.byProvider[result.provider]||0) + 1;
        } else {
          stats.failed++;
          stats.failedSymbols.push({
            symbol: sym.symbol,
            name: sym.name,
            exchange: sym.exchange,
            country: sym.country,
            companyDomain: sym.companyDomain,
            marketCap: sym.marketCap
          });
          await col.updateOne(
            { _id: sym._id },
            { $set: { logoAttemptedAt: new Date(), logoVerified: false, logoWaterfallFailed: true } }
          );
        }
      } catch(err) {
        stats.failed++;
        stats.failedSymbols.push({ symbol: sym.symbol, name: sym.name, error: err.message });
      }
    }));

    if (i % 200 === 0 && i > 0) {
      const el = ((Date.now()-start)/1000).toFixed(0);
      const rate = (stats.processed/el).toFixed(1);
      console.log(`[${el}s] ${i}/${symbols.length} ok=${stats.enriched} fail=${stats.failed} rate=${rate}/s`);
      console.log('  providers=' + JSON.stringify(stats.byProvider));
      // flush intermediate stats
      fs.writeFileSync(path.join(STATS_DIR, 'logo_waterfall_progress.json'),
        JSON.stringify({ ts: new Date().toISOString(), i, total: symbols.length, ...stats, failedSymbols: undefined, failedCount: stats.failedSymbols.length }, null, 2));
    }
    if (DELAY_BETWEEN_BATCHES > 0) await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
  }

  const el = ((Date.now()-start)/1000).toFixed(0);
  console.log('\n=== COMPLETE ===  time=' + el + 's');
  console.log('processed=' + stats.processed + ' enriched=' + stats.enriched + ' failed=' + stats.failed);
  console.log('providers=' + JSON.stringify(stats.byProvider, null, 2));

  // Save failed list
  fs.writeFileSync(path.join(STATS_DIR, 'logo_waterfall_failed.json'),
    JSON.stringify(stats.failedSymbols, null, 2));
  // Emit a txt for user
  const txtLines = stats.failedSymbols.map(s =>
    `${s.symbol || '?'}\t${s.exchange||'?'}\t${s.country||'?'}\t${s.companyDomain||''}\t${(s.name||'').substring(0,60)}`
  );
  fs.writeFileSync(path.join(STATS_DIR, 'logo_waterfall_failed.txt'),
    'SYMBOL\tEXCHANGE\tCOUNTRY\tDOMAIN\tNAME\n' + txtLines.join('\n'));

  // Final coverage
  const totalStocks = await col.countDocuments({ type: 'stock' });
  const verified = await col.countDocuments({ type: 'stock', logoVerified: true });
  const top5k = await col.find({ type: 'stock', marketCap:{$gt:0} }).sort({ marketCap:-1 }).limit(5000)
    .project({ logoVerified:1, iconUrl:1 }).toArray();
  const top5kVerified = top5k.filter(s => s.logoVerified === true).length;

  console.log('\n=== COVERAGE ===');
  console.log(`stocks total=${totalStocks}`);
  console.log(`stocks with logoVerified=true: ${verified}`);
  console.log(`top 5000 by mktcap verified: ${top5kVerified}/${top5k.length} (${(top5kVerified/top5k.length*100).toFixed(1)}%)`);

  fs.writeFileSync(path.join(STATS_DIR, 'logo_waterfall_summary.json'),
    JSON.stringify({ ts: new Date().toISOString(), elapsed_s: Number(el), processed: stats.processed, enriched: stats.enriched, failed: stats.failed, byProvider: stats.byProvider, totalStocks, verified, top5kVerified }, null, 2));

  await client.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
