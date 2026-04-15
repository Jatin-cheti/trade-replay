import {
  BOND_TYPE_OPTIONS,
  CATALOG_BY_CATEGORY,
  CRYPTO_EXCHANGE_TYPE_OPTIONS,
  CRYPTO_SOURCE_OPTIONS,
  CRYPTO_TYPE_OPTIONS,
  ECONOMY_CATEGORY_OPTIONS,
  ECONOMY_SOURCE_OPTIONS,
  FOREX_SOURCE_OPTIONS,
  FUND_TYPE_OPTIONS,
  FUTURE_CATEGORY_OPTIONS,
  GLOBAL_COUNTRY_OPTIONS,
  INDEX_SOURCE_OPTIONS,
  STOCK_SECTOR_OPTIONS,
  STOCK_TYPE_OPTIONS,
  type AssetCatalogItem,
  type AssetCategory,
  type AssetSearchFiltersResponse,
  type AssetSearchResponse,
} from "./assetCatalogDataset";

export type {
  AssetCatalogItem,
  AssetCategory,
  AssetMarketType,
  AssetSearchFilterOption,
  AssetSearchFiltersResponse,
  AssetSearchResponse,
} from "./assetCatalogDataset";

interface AssetSearchInput {
  q?: string;
  market?: string;
  category?: string;
  assetType?: string;
  country?: string;
  type?: string;
  sector?: string;
  source?: string;
  exchangeType?: string;
  futureCategory?: string;
  economyCategory?: string;
  expiry?: string;
  strike?: string;
  underlyingAsset?: string;
  page?: number;
  limit?: number;
}

function normalizeCategory(rawCategory?: string): AssetCategory | "all" {
  if (!rawCategory || !rawCategory.trim()) return "all";

  const normalized = rawCategory.trim().toLowerCase();

  if (normalized in CATALOG_BY_CATEGORY) {
    return normalized as AssetCategory;
  }

  if (normalized === "stock") return "stocks";
  if (normalized === "fund") return "funds";
  if (normalized === "future") return "futures";
  if (normalized === "commodity") return "futures";
  if (normalized === "forex") return "forex";
  if (normalized === "crypto") return "crypto";
  if (normalized === "index") return "indices";
  if (normalized === "bond") return "bonds";
  if (normalized === "economic") return "economy";
  if (normalized === "option") return "options";

  return "all";
}

function normalizeOptional(value?: string): string | undefined {
  if (!value) return undefined;
  const next = value.trim().toLowerCase();
  if (!next || next === "all") return undefined;
  return next;
}

function normalizeCountry(value?: string): string | undefined {
  return normalizeOptional(value);
}

function itemSearchScore(item: AssetCatalogItem, query: string): number {
  if (!query) return 1;

  const q = query.toLowerCase();
  const ticker = item.ticker.toLowerCase();
  const name = item.name.toLowerCase();
  const text = `${ticker} ${name}`;

  let baseScore = -1;
  if (ticker === q) baseScore = 120;
  else if (ticker.startsWith(q)) baseScore = 105;
  else if (name.startsWith(q)) baseScore = 92;
  else if (text.includes(q)) baseScore = 78;
  else if (isSubsequence(ticker, q)) baseScore = 62;
  else if (isSubsequence(name, q)) baseScore = 48;

  if (item.category === "futures" && item.contracts?.length) {
    const contractScores = item.contracts.map((contract) => itemSearchScore(contract, query));
    const bestContractScore = Math.max(...contractScores);
    if (bestContractScore > 0) {
      baseScore = Math.max(baseScore, bestContractScore - 4);
    }
  }

  return baseScore;
}

function isSubsequence(text: string, query: string): boolean {
  let cursor = 0;
  for (let i = 0; i < text.length && cursor < query.length; i += 1) {
    if (text[i] === query[cursor]) {
      cursor += 1;
    }
  }
  return cursor === query.length;
}

function cloneAsset(item: AssetCatalogItem): AssetCatalogItem {
  return {
    ...item,
    contracts: item.contracts?.map((contract) => ({ ...contract })),
  };
}

type NormalizedFilterState = {
  country: string | undefined;
  type: string | undefined;
  sector: string | undefined;
  source: string | undefined;
  exchangeType: string | undefined;
  futureCategory: string | undefined;
  economyCategory: string | undefined;
  expiry: string | undefined;
  strike: string | undefined;
  underlyingAsset: string | undefined;
};

function matchesFilters(item: AssetCatalogItem, input: NormalizedFilterState): boolean {
  if (input.country && item.country.toLowerCase() !== input.country) return false;
  if (input.type && item.type.toLowerCase() !== input.type) return false;
  if (input.sector && item.sector.toLowerCase() !== input.sector) return false;
  // Source filter matches either source field or country code (for indices with country-based sources)
  if (input.source) {
    const itemSource = item.source.toLowerCase();
    const itemCountry = item.country.toLowerCase();
    if (itemSource !== input.source && itemCountry !== input.source) return false;
  }
  if (input.exchangeType && item.exchangeType.toLowerCase() !== input.exchangeType) return false;
  if (input.futureCategory && (item.futureCategory ?? "").toLowerCase() !== input.futureCategory) return false;
  if (input.economyCategory && (item.economyCategory ?? "").toLowerCase() !== input.economyCategory) return false;
  if (input.expiry && (item.expiry ?? "").toLowerCase() !== input.expiry) return false;
  if (input.strike && (item.strike ?? "").toLowerCase() !== input.strike) return false;
  if (input.underlyingAsset && (item.underlyingAsset ?? "").toLowerCase() !== input.underlyingAsset) return false;
  return true;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const next = Number.parseInt(value, 10);
    if (Number.isFinite(next)) return next;
  }
  return fallback;
}

export async function searchAssetCatalog(input: AssetSearchInput): Promise<AssetSearchResponse> {
  const category = normalizeCategory(input.category ?? input.assetType ?? input.market);
  const country = normalizeCountry(input.country);
  const type = normalizeOptional(input.type);
  const sector = normalizeOptional(input.sector);
  const source = normalizeOptional(input.source);
  const exchangeType = normalizeOptional(input.exchangeType);
  const futureCategory = normalizeOptional(input.futureCategory);
  const economyCategory = normalizeOptional(input.economyCategory);
  const expiry = normalizeOptional(input.expiry);
  const strike = normalizeOptional(input.strike);
  const underlyingAsset = normalizeOptional(input.underlyingAsset);
  const query = (input.q ?? "").trim();

  const page = Math.max(1, toNumber(input.page, 1));
  const limit = Math.max(1, Math.min(100, toNumber(input.limit, 50)));

  const searchPool = category === "all"
    ? Object.values(CATALOG_BY_CATEGORY).flat()
    : CATALOG_BY_CATEGORY[category] ?? [];

  const uniqueMap = new Map<string, AssetCatalogItem>();
  for (const asset of searchPool) {
    const key = `${asset.category}|${asset.ticker}|${asset.exchange}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, asset);
    }
  }

  const filtered = Array.from(uniqueMap.values())
    .filter((asset) => matchesFilters(asset, {
      country,
      type,
      sector,
      source,
      exchangeType,
      futureCategory,
      economyCategory,
      expiry,
      strike,
      underlyingAsset,
    }))
    .map((asset) => ({ asset, score: itemSearchScore(asset, query) }))
    .filter((row) => row.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.asset.ticker.localeCompare(right.asset.ticker);
    });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit).map((row) => cloneAsset(row.asset));

  return {
    assets: paged,
    total,
    page,
    limit,
    hasMore: start + limit < total,
  };
}

function emptyFilters(sourceUiType: "modal" | "dropdown" = "modal"): AssetSearchFiltersResponse {
  return {
    activeFilters: [],
    countries: [],
    types: [],
    sectors: [],
    sources: [],
    exchangeTypes: [],
    futureCategories: [],
    economyCategories: [],
    expiries: [],
    strikes: [],
    underlyingAssets: [],
    sourceUiType,
  };
}

export async function fetchAssetCatalogFilters(input?: { category?: string }): Promise<AssetSearchFiltersResponse> {
  const category = normalizeCategory(input?.category);

  if (category === "all") {
    return emptyFilters("modal");
  }

  switch (category) {
    case "stocks": {
      return {
        ...emptyFilters("modal"),
        activeFilters: ["country", "type", "sector"],
        countries: GLOBAL_COUNTRY_OPTIONS,
        types: STOCK_TYPE_OPTIONS,
        sectors: STOCK_SECTOR_OPTIONS,
      };
    }

    case "funds": {
      return {
        ...emptyFilters("modal"),
        activeFilters: ["country", "type"],
        countries: GLOBAL_COUNTRY_OPTIONS,
        types: FUND_TYPE_OPTIONS,
      };
    }

    case "futures": {
      return {
        ...emptyFilters("modal"),
        activeFilters: ["futureCategory", "country"],
        countries: GLOBAL_COUNTRY_OPTIONS,
        futureCategories: FUTURE_CATEGORY_OPTIONS,
      };
    }

    case "forex": {
      return {
        ...emptyFilters("modal"),
        activeFilters: ["source"],
        sources: FOREX_SOURCE_OPTIONS,
      };
    }

    case "crypto": {
      return {
        ...emptyFilters("modal"),
        activeFilters: ["source", "type", "exchangeType"],
        sources: CRYPTO_SOURCE_OPTIONS,
        types: CRYPTO_TYPE_OPTIONS,
        exchangeTypes: CRYPTO_EXCHANGE_TYPE_OPTIONS,
      };
    }

    case "indices": {
      return {
        ...emptyFilters("modal"),
        activeFilters: ["source"],
        sources: INDEX_SOURCE_OPTIONS,
      };
    }

    case "bonds": {
      return {
        ...emptyFilters("modal"),
        activeFilters: ["country", "type"],
        countries: GLOBAL_COUNTRY_OPTIONS,
        types: BOND_TYPE_OPTIONS,
      };
    }

    case "economy": {
      return {
        ...emptyFilters("dropdown"),
        activeFilters: ["country", "source", "economyCategory"],
        countries: GLOBAL_COUNTRY_OPTIONS,
        sources: ECONOMY_SOURCE_OPTIONS,
        economyCategories: ECONOMY_CATEGORY_OPTIONS,
      };
    }

    case "options": {
      return {
        ...emptyFilters("modal"),
        activeFilters: ["country", "type", "expiry", "underlyingAsset"],
        countries: GLOBAL_COUNTRY_OPTIONS,
        types: [
          { value: "all", label: "All Types" },
          { value: "call", label: "Call" },
          { value: "put", label: "Put" },
        ],
        expiries: [
          { value: "all", label: "All Expiries" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
          { value: "quarterly", label: "Quarterly" },
        ],
        underlyingAssets: [
          { value: "all", label: "All Underlying" },
          { value: "AAPL", label: "Apple Inc." },
          { value: "MSFT", label: "Microsoft Corp." },
          { value: "TSLA", label: "Tesla Inc." },
          { value: "AMZN", label: "Amazon.com" },
          { value: "GOOGL", label: "Alphabet Inc." },
          { value: "META", label: "Meta Platforms" },
          { value: "NVDA", label: "NVIDIA Corp." },
          { value: "SPY", label: "SPDR S&P 500 ETF" },
          { value: "QQQ", label: "Invesco QQQ Trust" },
          { value: "NIFTY", label: "NIFTY 50" },
          { value: "BANKNIFTY", label: "Bank NIFTY" },
        ],
      };
    }

    default: {
      return emptyFilters("modal");
    }
  }
}
