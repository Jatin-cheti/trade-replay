#!/usr/bin/env node
/**
 * IND-008 / IN-08: NSE Active F&O Contracts
 *
 * Ingests currently-listed F&O contracts from the NSE FO bhavcopy (latest trading day).
 * Filters:
 *   - FUT (stock + index futures) — all current + next month expiries
 *   - OPT (stock + index options) — OPEN_INT > 0 (skip zero-OI strikes)
 *
 * Writes to: cleanassets (the screener's authoritative collection).
 * Source:   nse_official (confidence 1.0).
 *
 * Honest limitations:
 *   - NSE CSV URL path changes occasionally; tries a small set of candidates.
 *   - On weekends / holidays there may be no new bhavcopy available.
 *   - Zero-OI options intentionally excluded to cap volume at useful contracts.
 */
'use strict';
require('dotenv').config();
const https = require('https');
const zlib = require('zlib');
const { MongoClient } = require('mongodb');

const MONGO = process.env.MONGO_URI || process.env.MONGO_URI_LOCAL || 'mongodb://10.122.0.2:27017/tradereplay';
const DB = 'tradereplay';
const COLL = 'cleanassets';

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://www.nseindia.com/',
      },
      insecureHTTPParser: true,
      timeout: 30000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchBuf(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function fmt(d, sep='') {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd = String(d.getUTCDate()).padStart(2,'0');
  return `${y}${sep}${m}${sep}${dd}`;
}

async function findBhavcopy() {
  const today = new Date();
  for (let back = 0; back < 10; back++) {
    const d = new Date(today.getTime() - back*24*3600*1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth()+1).padStart(2,'0');
    const dd = String(d.getUTCDate()).padStart(2,'0');
    // Newer format (post 2024-07): NSE UDiFF daily zip
    const candidates = [
      `https://archives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${y}${m}${dd}_F_0000.csv.zip`,
      `https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${y}${m}${dd}_F_0000.csv.zip`,
    ];
    for (const url of candidates) {
      try {
        const buf = await fetchBuf(url);
        console.log(`[bhavcopy] got ${buf.length} bytes from ${url}`);
        return { url, buf };
      } catch (e) {
        // try next
      }
    }
  }
  throw new Error('no bhavcopy found in last 10 days');
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const row = {};
    header.forEach((h, j) => { row[h] = (parts[j]||'').trim(); });
    rows.push(row);
  }
  return rows;
}

function unzipFirst(buf) {
  // Minimal local-file-header unzip for the first entry (NSE ships single-entry zips)
  let off = 0;
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('not a zip');
  const compMethod = buf.readUInt16LE(8);
  const compSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + nameLen + extraLen;
  const compData = buf.slice(dataStart, dataStart + compSize);
  if (compMethod === 0) return compData.toString('utf8');
  if (compMethod === 8) return zlib.inflateRawSync(compData).toString('utf8');
  throw new Error(`unsupported zip compression ${compMethod}`);
}

function buildSymbol(row) {
  // NSE UDiFF columns: TckrSymb, FinInstrmTp (STF/IDF/STO/IDO), XpryDt (yyyy-mm-dd),
  // StrkPric, OptnTp (CE/PE), OpnIntrst, ClsPric, etc.
  const ticker = (row.TckrSymb || row.SYMBOL || '').toUpperCase();
  const inst = (row.FinInstrmTp || row.INSTRUMENT || '').toUpperCase();
  const xpry = row.XpryDt || row.EXPIRY_DT || '';
  const strike = row.StrkPric || row.STRIKE_PR || '';
  const opt = (row.OptnTp || row.OPTION_TYP || '').toUpperCase();
  const oi = Number(row.OpnIntrst || row.OPEN_INT || 0);
  const close = Number(row.ClsPric || row.CLOSE || 0);

  if (!ticker || !inst) return null;
  const isFut = inst === 'STF' || inst === 'IDF' || inst === 'FUTSTK' || inst === 'FUTIDX';
  const isOpt = inst === 'STO' || inst === 'IDO' || inst === 'OPTSTK' || inst === 'OPTIDX';
  if (!isFut && !isOpt) return null;
  if (!xpry) return null;
  if (isOpt) {
    if (!opt || (opt !== 'CE' && opt !== 'PE')) return null;
    if (oi <= 0) return null; // skip zero-OI strikes
    if (!strike) return null;
  }
  // Expiry filter: current + next 60 days
  const xd = new Date(xpry);
  if (isNaN(xd.getTime())) return null;
  const now = new Date();
  const maxD = new Date(now.getTime() + 65*24*3600*1000);
  if (xd < new Date(now.getTime() - 2*24*3600*1000) || xd > maxD) return null;

  const xpryCompact = fmt(xd, '');
  let symbol, fullSymbol, type, name;
  if (isFut) {
    symbol = `${ticker}-FUT-${xpryCompact}`;
    name = `${ticker} Futures ${xpry}`;
    type = 'futures';
  } else {
    const strikeNum = Number(strike).toFixed(0);
    symbol = `${ticker}-${opt}-${strikeNum}-${xpryCompact}`;
    name = `${ticker} ${opt} ${strikeNum} ${xpry}`;
    type = 'options';
  }
  fullSymbol = `NSE:${symbol}`;

  return {
    fullSymbol,
    symbol,
    name,
    companyName: ticker,
    underlyingSymbol: `NSE:${ticker}`,
    exchange: 'NSE',
    country: 'IN',
    type,
    currency: 'INR',
    contractType: isFut ? 'FUT' : opt,
    strikePrice: isOpt ? Number(strike) : null,
    expiryDate: xpry,
    openInterest: oi,
    currentPrice: close,
    sourceName: 'nse_official',
    isActive: true,
    isCleanAsset: true,
    ingestedAt: new Date(),
    loop: 'loop5',
  };
}

async function main() {
  const client = new MongoClient(MONGO);
  await client.connect();
  const coll = client.db(DB).collection(COLL);
  const stats = { fetched: 0, parsed: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  let text;
  try {
    const { buf } = await findBhavcopy();
    text = unzipFirst(buf);
  } catch (e) {
    console.error(`[FATAL] ${e.message}`);
    await client.close();
    process.exit(2);
  }

  const rows = parseCsv(text);
  stats.fetched = rows.length;
  console.log(`[bhavcopy] parsed ${rows.length} rows`);

  for (const r of rows) {
    stats.parsed++;
    try {
      const doc = buildSymbol(r);
      if (!doc) { stats.skipped++; continue; }
      stats.valid++;
      const res = await coll.updateOne(
        { fullSymbol: doc.fullSymbol },
        { $setOnInsert: { createdAt: new Date() }, $set: doc },
        { upsert: true }
      );
      if (res.upsertedCount) stats.inserted++; else stats.updated++;
    } catch (e) {
      stats.errors++;
      if (stats.errors < 5) console.error(`[err] ${e.message}`);
    }
  }

  console.log(JSON.stringify({ batchId: `nse_fo_active_${Date.now()}`, ...stats }, null, 2));
  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
