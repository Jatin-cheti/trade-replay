#!/usr/bin/env node
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

// load .env
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const key = process.env.FMP_API_KEY;
const sym = 'NVDA';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    let data = '';
    https.get(url, r => {
      r.on('data', c => (data += c));
      r.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const endpoints = [
    `https://financialmodelingprep.com/stable/profile?symbol=${sym}&apikey=${key}`,
    `https://financialmodelingprep.com/stable/quote?symbol=${sym}&apikey=${key}`,
    `https://financialmodelingprep.com/stable/historical-market-capitalization?symbol=${sym}&limit=1&apikey=${key}`,
  ];

  for (const url of endpoints) {
    const name = url.match(/\/stable\/([^?]+)/)[1];
    try {
      const parsed = await fetchJson(url);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!obj || obj.message || obj['Error Message']) {
        console.log(`=== ${name} ===\n  Error:`, obj?.message || obj?.['Error Message'] || JSON.stringify(obj));
        continue;
      }
      const volFields = Object.keys(obj).filter(k => /vol|avg/i.test(k));
      console.log(`\n=== ${name} ===`);
      if (volFields.length === 0) {
        console.log('  (no vol/avg fields found)');
        // show all keys for context
        Object.keys(obj).forEach(k => console.log(`  ${k}: ${obj[k]}`));
      } else {
        volFields.forEach(f => console.log(`  ${f}: ${obj[f]}`));
      }
    } catch (e) {
      console.log(`=== ${name} === ERROR:`, e.message);
    }
  }
}

main().catch(console.error);
