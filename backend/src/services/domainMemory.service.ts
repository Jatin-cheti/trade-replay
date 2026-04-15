import { DomainMemoryModel } from "../models/DomainMemory";
import { saveToDomainDataset } from "./curatedDomainDataset.service";

const domainCache = new Map<string, string>();

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function extractBaseSymbol(symbol: string): string {
  return normalizeSymbol(symbol).split(/[-.$]/)[0] || normalizeSymbol(symbol);
}

export async function getKnownDomain(symbol: string): Promise<string | null> {
  const normalized = normalizeSymbol(symbol);
  const base = extractBaseSymbol(normalized);

  if (domainCache.has(normalized)) return domainCache.get(normalized)!;
  if (domainCache.has(base)) return domainCache.get(base)!;

  const record = await DomainMemoryModel.findOne({
    $or: [{ symbol: normalized }, { symbol: base }, { baseSymbol: base }],
    verified: true,
  })
    .sort({ confidence: -1 })
    .select({ symbol: 1, baseSymbol: 1, domain: 1 })
    .lean<{ symbol: string; baseSymbol: string; domain: string } | null>();

  if (!record?.domain) return null;

  domainCache.set(record.symbol, record.domain);
  domainCache.set(record.baseSymbol, record.domain);
  domainCache.set(normalized, record.domain);
  return record.domain;
}

export async function rememberResolvedDomain(input: {
  symbol: string;
  domain: string;
  confidence: number;
  source: string;
  companyName: string;
}): Promise<void> {
  const normalized = normalizeSymbol(input.symbol);
  const base = extractBaseSymbol(normalized);
  const domain = input.domain.trim().toLowerCase();

  const payload = {
    domain,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    source: input.source.trim().toLowerCase() || "resolver",
    companyName: input.companyName.trim(),
    verified: true,
    verifiedAt: new Date(),
  };

  await Promise.all([
    DomainMemoryModel.updateOne(
      { symbol: normalized },
      {
        $set: {
          ...payload,
          baseSymbol: base,
        },
      },
      { upsert: true },
    ),
    DomainMemoryModel.updateOne(
      { symbol: base },
      {
        $set: {
          ...payload,
          baseSymbol: base,
        },
      },
      { upsert: true },
    ),
  ]);

  domainCache.set(normalized, domain);
  domainCache.set(base, domain);

  await Promise.all([
    saveToDomainDataset(normalized, domain, input.confidence),
    saveToDomainDataset(base, domain, input.confidence),
  ]);
}
