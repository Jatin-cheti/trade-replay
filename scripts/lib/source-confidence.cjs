/**
 * SOURCE CONFIDENCE REGISTRY + MERGE DECISION
 * Spec reference: Section 4.2 of corrective execution prompt.
 *
 * Every enrichment/ingestion script MUST import decideMerge from here
 * before writing any field. Unregistered sources default to 0.0 and
 * therefore cannot overwrite any field with a registered source.
 */

"use strict";

const SOURCE_CONFIDENCE_REGISTRY = Object.freeze({
  // India — Official (1.0)
  NSE_official: 1.0,
  BSE_official: 1.0,
  SEBI_filings: 0.98,
  // India — High Quality
  screener_in: 0.92,
  tickertape: 0.88,
  moneycontrol: 0.85,
  economictimes: 0.82,
  // India — Medium Quality
  nseindia_web_scrape: 0.75,
  bseindia_web_scrape: 0.7,
  // Global — High Quality
  alpha_vantage: 0.88,
  polygon_io: 0.85,
  twelve_data: 0.82,
  fmp: 0.8,
  yfinance: 0.75,
  yahoo_quote: 0.78,
  yahoo_summary: 0.8,
  // Global — Medium Quality (logos only)
  clearbit: 0.6,
  brandfetch: 0.65,
  logo_dev: 0.55,
  google_favicon: 0.35,
  // Low Quality / Generated
  generated_template: 0.1,
  ai_generated: 0.05,
  unknown: 0.0,
});

function getSourceConfidence(sourceName) {
  if (!sourceName) return 0.0;
  const c = SOURCE_CONFIDENCE_REGISTRY[sourceName];
  if (c === undefined) {
    // Emit warning once per unknown source to avoid log spam
    if (!getSourceConfidence._warned) getSourceConfidence._warned = new Set();
    if (!getSourceConfidence._warned.has(sourceName)) {
      getSourceConfidence._warned.add(sourceName);
      console.warn(`[EnrichmentMerge] Source "${sourceName}" not in registry. Defaulting to 0.0.`);
    }
    return 0.0;
  }
  return c;
}

/**
 * decideMerge — returns { shouldWrite, reasonCode, explanation }
 * reasonCode ∈ { NULL_SKIP, NEW_VALUE, SOURCE_UPGRADE, LOWER_CONFIDENCE_SKIP }
 */
function decideMerge(existingValue, incomingValue, existingSource, incomingSource) {
  const isBlank = (v) => v === null || v === undefined || v === "" || (typeof v === "number" && !Number.isFinite(v));

  // Rule 1: Never write null/undefined/empty/NaN/Infinity incoming
  if (isBlank(incomingValue)) {
    return {
      shouldWrite: false,
      reasonCode: "NULL_SKIP",
      explanation: `Incoming value is blank from source "${incomingSource}". Existing preserved.`,
    };
  }

  // Rule 2: Empty slot -> always write
  if (isBlank(existingValue)) {
    return {
      shouldWrite: true,
      reasonCode: "NEW_VALUE",
      explanation: `No existing value. Writing from "${incomingSource}".`,
    };
  }

  // Rule 3: Compare confidence
  const eConf = getSourceConfidence(existingSource);
  const iConf = getSourceConfidence(incomingSource);
  if (iConf >= eConf) {
    return {
      shouldWrite: true,
      reasonCode: "SOURCE_UPGRADE",
      explanation: `Incoming "${incomingSource}" (${iConf}) ≥ existing "${existingSource}" (${eConf}). Updating.`,
    };
  }
  return {
    shouldWrite: false,
    reasonCode: "LOWER_CONFIDENCE_SKIP",
    explanation: `Incoming "${incomingSource}" (${iConf}) < existing "${existingSource}" (${eConf}). Preserved.`,
  };
}

module.exports = {
  SOURCE_CONFIDENCE_REGISTRY,
  getSourceConfidence,
  decideMerge,
};
