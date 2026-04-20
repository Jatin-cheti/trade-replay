#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq === -1 || line.startsWith('#')) continue;
    const k = line.slice(0, eq).trim();
    if (k && !process.env[k]) process.env[k] = line.slice(eq + 1).trim();
  }
}

const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tradereplay';

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  const syms = ['NVDA', 'MSFT', 'AAPL', 'AMZN'];
  for (const sym of syms) {
    const doc = await db.collection('cleanassets').findOne(
      { symbol: sym },
      { projection: { avgVolume: 1, symbol: 1, fullSymbol: 1 } }
    );
    console.log(sym, JSON.stringify(doc));
  }

  // Count docs with avgVolume
  const count = await db.collection('cleanassets').countDocuments({ avgVolume: { $exists: true } });
  console.log('cleanassets with avgVolume:', count);

  await client.close();
}

main().catch(console.error);
