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

const fixturePath = path.resolve(process.cwd(), "e2e", "fixtures", "symbols.json");
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

async function fulfillAssets(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const payload = toPagedResponse(url);

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

export async function installSymbolSearchMock(page: Page): Promise<void> {
  await page.route("**/api/simulation/assets**", fulfillAssets);
}
