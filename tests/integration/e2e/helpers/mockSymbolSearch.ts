import type { Page, Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type AssetFixture = {
  ticker: string;
  symbol: string;
  name: string;
  exchange: string;
  region: string;
  instrumentType: string;
  type: string;
  category: string;
  assetType: string;
  market: string;
  country: string;
  sector: string;
  exchangeType: string;
  icon: string;
  exchangeIcon: string;
  exchangeLogoUrl: string;
  iconUrl: string;
  logoUrl: string;
  source: string;
  futureCategory?: string;
  economyCategory?: string;
  contracts?: AssetFixture[];
};

type SymbolFixtureData = {
  assets: AssetFixture[];
};

const fixturePath = path.resolve(process.cwd(), "tests", "integration", "e2e", "fixtures", "symbols.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as SymbolFixtureData;

function includesNormalized(haystack: string | undefined, needle: string): boolean {
  if (!needle) return true;
  return (haystack ?? "").toLowerCase().includes(needle.toLowerCase());
}

function matchesFilters(item: AssetFixture, params: URLSearchParams): boolean {
  const q = (params.get("q") ?? "").trim();
  const category = (params.get("category") ?? params.get("market") ?? "").trim().toLowerCase();
  const country = (params.get("country") ?? "").trim().toUpperCase();

  if (category && category !== "all" && item.category.toLowerCase() !== category) {
    return false;
  }

  if (country && item.country.toUpperCase() !== country) {
    return false;
  }

  if (q) {
    const queryMatched = includesNormalized(item.ticker, q)
      || includesNormalized(item.symbol, q)
      || includesNormalized(item.name, q)
      || includesNormalized(item.exchange, q);
    if (!queryMatched) {
      return false;
    }
  }

  return true;
}

function toPagedResponse(url: URL): {
  assets: AssetFixture[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
} {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25);

  const filtered = fixture.assets.filter((item) => matchesFilters(item, url.searchParams));
  const offset = (page - 1) * limit;
  const pageItems = filtered.slice(offset, offset + limit);

  return {
    assets: pageItems,
    total: filtered.length,
    page,
    limit,
    hasMore: offset + limit < filtered.length,
  };
}

function toTradingViewResponse(url: URL): {
  symbols: AssetFixture[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
} {
  const text = (url.searchParams.get("text") ?? "").trim();
  const exchange = (url.searchParams.get("exchange") ?? "").trim().toUpperCase();
  const type = (url.searchParams.get("type") ?? url.searchParams.get("category") ?? "").trim().toLowerCase();

  const start = Math.max(0, Number.parseInt(url.searchParams.get("start") ?? "0", 10) || 0);
  const limit = Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50);

  const filtered = fixture.assets.filter((item) => {
    if (type && type !== "all") {
      const itemType = (item.type ?? "").toLowerCase();
      const itemCategory = (item.category ?? "").toLowerCase();
      if (itemType !== type && itemCategory !== type) {
        return false;
      }
    }

    if (exchange) {
      const itemExchange = (item.exchange ?? "").toUpperCase();
      const itemSource = (item.source ?? "").toUpperCase();
      if (itemExchange !== exchange && itemSource !== exchange && (item.country ?? "").toUpperCase() !== exchange) {
        return false;
      }
    }

    if (text) {
      const queryMatched = includesNormalized(item.ticker, text)
        || includesNormalized(item.symbol, text)
        || includesNormalized(item.name, text)
        || includesNormalized(item.exchange, text);
      if (!queryMatched) {
        return false;
      }
    }

    return true;
  });

  const symbols = filtered.slice(start, start + limit);
  const consumed = start + symbols.length;
  const hasMore = consumed < filtered.length;

  return {
    symbols,
    total: filtered.length,
    nextCursor: hasMore ? String(consumed) : null,
    hasMore,
  };
}

async function fulfillAssets(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const payload = toPagedResponse(url);

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

async function fulfillTradingViewSearch(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const payload = toTradingViewResponse(url);

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

export async function installSymbolSearchMock(page: Page): Promise<void> {
  await page.route("**/api/simulation/assets**", fulfillAssets);
  await page.route("**/api/symbol-search**", fulfillTradingViewSearch);
}
