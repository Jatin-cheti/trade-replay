import { CleanAssetModel } from "../models/CleanAsset.js";
import { SymbolModel } from "../models/Symbol.js";

interface CatalogStats {
  totalSymbols: number;
  totalCleanAssets: number;
  byType: Record<string, number>;
  byCountry: Record<string, number>;
}

export async function getCatalogStats(): Promise<CatalogStats> {
  const [totalSymbols, totalCleanAssets, typeAgg, countryAgg] = await Promise.all([
    SymbolModel.estimatedDocumentCount(),
    CleanAssetModel.estimatedDocumentCount(),
    CleanAssetModel.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
    CleanAssetModel.aggregate([
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]),
  ]);

  const byType: Record<string, number> = {};
  for (const row of typeAgg) byType[row._id as string] = row.count as number;

  const byCountry: Record<string, number> = {};
  for (const row of countryAgg) byCountry[row._id as string] = row.count as number;

  return { totalSymbols, totalCleanAssets, byType, byCountry };
}

export async function listSymbols(params: {
  type?: string;
  country?: string;
  limit: number;
  offset: number;
}): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const filter: Record<string, unknown> = { isActive: true };
  if (params.type) filter.type = params.type;
  if (params.country) filter.country = params.country.toUpperCase();

  const [items, total] = await Promise.all([
    CleanAssetModel.find(filter)
      .sort({ priorityScore: -1 })
      .skip(params.offset)
      .limit(params.limit)
      .select("symbol fullSymbol name exchange country type currency sector iconUrl s3Icon marketCap volume priorityScore")
      .lean(),
    CleanAssetModel.countDocuments(filter),
  ]);

  return { items: items as Record<string, unknown>[], total };
}
