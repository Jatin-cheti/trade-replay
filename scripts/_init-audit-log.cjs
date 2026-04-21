/**
 * Initialize enrichment_audit_log collection + indexes on production MongoDB.
 * Idempotent — safe to run repeatedly.
 * Run on server: node scripts/_init-audit-log.cjs
 */

"use strict";
require("dotenv").config();
const { MongoClient } = require("mongodb");
const { initAuditLog, AUDIT_COLLECTION } = require("./lib/merge-field-audit.cjs");

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGO_URI_LOCAL || "mongodb://10.122.0.2:27017/tradereplay";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  await initAuditLog(db);
  const indexes = await db.collection(AUDIT_COLLECTION).indexes();
  const count = await db.collection(AUDIT_COLLECTION).estimatedDocumentCount();
  console.log(JSON.stringify({
    collection: AUDIT_COLLECTION,
    indexes: indexes.map((i) => i.name),
    currentDocs: count,
  }, null, 2));
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
