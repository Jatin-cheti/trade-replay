/**
 * mergeFieldWithAudit — per-field no-clobber updater with audit trail.
 * Spec reference: Section 4.2 of corrective execution prompt.
 *
 * Usage:
 *   const { mergeFieldWithAudit, initAuditLog } = require("./lib/merge-field-audit.cjs");
 *   await initAuditLog(db);
 *   await mergeFieldWithAudit({
 *     db, collection: "cleanassets", symbolId, fieldName: "pe",
 *     incomingValue: 24.5, incomingSource: "yahoo_quote",
 *     batchId: "W8-india-yahoo-v3-2026-04-21",
 *   });
 *
 * Contract:
 *  - Never writes null/undefined/empty/NaN/Infinity.
 *  - Never overwrites a higher-confidence value with a lower-confidence one.
 *  - Writes an audit row for EVERY decision (including skips).
 *  - Stores source + updatedAt on the target doc under enrichMeta.{field}.
 */

"use strict";

const { decideMerge, getSourceConfidence } = require("./source-confidence.cjs");

const AUDIT_COLLECTION = "enrichment_audit_log";

/** Ensure the audit collection + indexes exist. Safe to call repeatedly. */
async function initAuditLog(db) {
  const existing = await db.listCollections({ name: AUDIT_COLLECTION }).toArray();
  if (existing.length === 0) {
    await db.createCollection(AUDIT_COLLECTION);
  }
  const coll = db.collection(AUDIT_COLLECTION);
  await coll.createIndexes([
    { key: { symbolId: 1 }, name: "idx_audit_symbol" },
    { key: { fieldName: 1 }, name: "idx_audit_field" },
    { key: { updatedAt: -1 }, name: "idx_audit_updated" },
    { key: { batchId: 1 }, name: "idx_audit_batch" },
    { key: { reasonCode: 1 }, name: "idx_audit_reason" },
  ]);
  return coll;
}

/**
 * @param {Object} params
 * @param {import("mongodb").Db} params.db
 * @param {string} params.collection               Target collection, usually "cleanassets".
 * @param {string} params.symbolId                 _id or symbol identifier.
 * @param {Object} [params.filter]                 Additional match filter (defaults to { symbol: symbolId }).
 * @param {string} params.fieldName
 * @param {*}      params.incomingValue
 * @param {string} params.incomingSource           MUST be in SOURCE_CONFIDENCE_REGISTRY.
 * @param {string} params.batchId
 * @param {boolean} [params.dryRun=false]          When true, decision is logged but no DB write occurs.
 * @returns {Promise<{written:boolean, reasonCode:string, decision:Object}>}
 */
async function mergeFieldWithAudit(params) {
  const {
    db,
    collection,
    symbolId,
    filter,
    fieldName,
    incomingValue,
    incomingSource,
    batchId,
    dryRun = false,
  } = params;

  if (!db || !collection || !symbolId || !fieldName || !incomingSource || !batchId) {
    throw new Error("mergeFieldWithAudit: missing required parameter");
  }

  const target = db.collection(collection);
  const matchFilter = filter || { symbol: symbolId };
  // Fetch existing value + source in a single read
  const proj = { [fieldName]: 1, [`enrichMeta.${fieldName}.source`]: 1 };
  const doc = await target.findOne(matchFilter, { projection: proj });
  const existingValue = doc ? doc[fieldName] : undefined;
  const existingSource = doc && doc.enrichMeta && doc.enrichMeta[fieldName]
    ? doc.enrichMeta[fieldName].source
    : "unknown";

  const decision = decideMerge(existingValue, incomingValue, existingSource, incomingSource);
  const auditRow = {
    symbolId,
    fieldName,
    oldValue: existingValue === undefined ? null : existingValue,
    newValue: incomingValue === undefined ? null : incomingValue,
    oldSource: existingSource,
    newSource: incomingSource,
    oldConfidence: getSourceConfidence(existingSource),
    newConfidence: getSourceConfidence(incomingSource),
    reasonCode: decision.reasonCode,
    batchId,
    updatedAt: new Date(),
    dryRun: !!dryRun,
  };
  await db.collection(AUDIT_COLLECTION).insertOne(auditRow);

  if (decision.shouldWrite && !dryRun) {
    await target.updateOne(matchFilter, {
      $set: {
        [fieldName]: incomingValue,
        [`enrichMeta.${fieldName}.source`]: incomingSource,
        [`enrichMeta.${fieldName}.updatedAt`]: new Date(),
        [`enrichMeta.${fieldName}.batchId`]: batchId,
      },
    });
  }

  return { written: decision.shouldWrite && !dryRun, reasonCode: decision.reasonCode, decision };
}

module.exports = { mergeFieldWithAudit, initAuditLog, AUDIT_COLLECTION };
