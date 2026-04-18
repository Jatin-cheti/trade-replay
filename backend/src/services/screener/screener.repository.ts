import type { FilterQuery } from "mongoose";
import { CleanAssetModel } from "../../models/CleanAsset";
import { SymbolModel } from "../../models/Symbol";
import type { ScreenerRepositoryQuery, ScreenerRepositorySort } from "./screener.types";

export interface ScreenerAssetDoc {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  s3Icon?: string;
  iconUrl?: string;
  companyDomain?: string;
  sector?: string;
  source?: string;
  popularity?: number;
  priorityScore?: number;
  marketCap?: number;
  volume?: number;
  liquidityScore?: number;
  isPrimaryListing?: boolean;
  isSynthetic?: boolean;
}

const DEFAULT_SELECT_FIELDS =
  "symbol fullSymbol name exchange country type currency s3Icon iconUrl companyDomain sector source popularity priorityScore marketCap volume liquidityScore isPrimaryListing isSynthetic";

function buildRegexQuery(input?: string): RegExp | null {
  if (!input) return null;
  const escaped = input.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return null;
  return new RegExp(escaped, "i");
}

function buildBaseQuery(params: ScreenerRepositoryQuery): FilterQuery<ScreenerAssetDoc> {
  const query: FilterQuery<ScreenerAssetDoc> = {};

  if (params.typeAssetValues.length > 0) {
    query.type = { $in: params.typeAssetValues };
  }

  if (params.countries.length > 0) {
    query.country = { $in: params.countries };
  }

  if (params.exchanges.length > 0) {
    query.exchange = { $in: params.exchanges };
  }

  if (params.sectors.length > 0) {
    query.sector = { $in: params.sectors };
  }

  if (params.primaryListingOnly) {
    query.isPrimaryListing = true;
  }

  if (params.marketCap?.min !== undefined || params.marketCap?.max !== undefined) {
    const marketCapFilter: { $gte?: number; $lte?: number } = {};
    if (params.marketCap.min !== undefined) marketCapFilter.$gte = params.marketCap.min;
    if (params.marketCap.max !== undefined) marketCapFilter.$lte = params.marketCap.max;
    query.marketCap = marketCapFilter;
  }

  if (params.volume?.min !== undefined || params.volume?.max !== undefined) {
    const volumeFilter: { $gte?: number; $lte?: number } = {};
    if (params.volume.min !== undefined) volumeFilter.$gte = params.volume.min;
    if (params.volume.max !== undefined) volumeFilter.$lte = params.volume.max;
    query.volume = volumeFilter;
  }

  const q = buildRegexQuery(params.query);
  if (q) {
    query.$or = [{ symbol: q }, { name: q }, { fullSymbol: q }];
  }

  return query;
}

function toMongoSort(sort: ScreenerRepositorySort): Record<string, 1 | -1> {
  const order = sort.order === "asc" ? 1 : -1;
  const field = sort.field;

  if (field === "symbol" || field === "name" || field === "marketCap" || field === "volume" || field === "priorityScore" || field === "liquidityScore" || field === "popularity") {
    return { [field]: order, priorityScore: -1, symbol: 1 };
  }

  return { priorityScore: -1, symbol: 1 };
}

export async function listAssets(
  params: ScreenerRepositoryQuery,
  sort: ScreenerRepositorySort,
  offset: number,
  limit: number,
): Promise<ScreenerAssetDoc[]> {
  const query = buildBaseQuery(params);
  const mongoSort = toMongoSort(sort);

  return CleanAssetModel.find(query)
    .sort(mongoSort)
    .skip(offset)
    .limit(limit)
    .select(DEFAULT_SELECT_FIELDS)
    .lean<ScreenerAssetDoc[]>();
}

export async function countAssets(params: ScreenerRepositoryQuery): Promise<number> {
  return CleanAssetModel.countDocuments(buildBaseQuery(params));
}

export async function findAssetBySymbol(symbolOrFullSymbol: string): Promise<ScreenerAssetDoc | null> {
  const symbolUpper = symbolOrFullSymbol.toUpperCase();
  const decoded = symbolUpper.includes("%") ? decodeURIComponent(symbolUpper) : symbolUpper;

  const byFull = await CleanAssetModel.findOne({ fullSymbol: decoded })
    .select(DEFAULT_SELECT_FIELDS)
    .lean<ScreenerAssetDoc | null>();
  if (byFull) return byFull;

  const bySymbol = await CleanAssetModel.findOne({ symbol: decoded })
    .sort({ priorityScore: -1 })
    .select(DEFAULT_SELECT_FIELDS)
    .lean<ScreenerAssetDoc | null>();
  if (bySymbol) return bySymbol;

  const fallbackSymbol = await SymbolModel.findOne({ symbol: decoded })
    .sort({ priorityScore: -1 })
    .select(DEFAULT_SELECT_FIELDS)
    .lean<ScreenerAssetDoc | null>();

  return fallbackSymbol;
}
