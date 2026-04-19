import { expect, test } from "./playwright-fixture";

type SnapshotQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: "snapshot-live";
};

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8080";
const baseEpoch = 1_710_000_000;

async function bootstrapAuthenticatedSession(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(baseUrl);
  await page.evaluate(() => {
    window.localStorage.setItem("sim_token", "e2e-token");
  });
}

function buildCandles(count = 260): Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }> {
  return Array.from({ length: count }, (_, index) => {
    const open = 190 + index * 0.08;
    const close = open + Math.sin(index / 9) * 0.9;
    const high = Math.max(open, close) + 0.7;
    const low = Math.min(open, close) - 0.7;
    return {
      time: new Date((baseEpoch + index * 60) * 1000).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 100_000 + index * 123,
    };
  });
}

function buildQuote(symbol: string, index = 0): SnapshotQuote {
  return {
    symbol,
    price: Number((200 + index).toFixed(2)),
    change: Number((0.4 + index * 0.05).toFixed(2)),
    changePercent: Number((0.2 + index * 0.1).toFixed(2)),
    volume: 100_000 + index * 111,
    timestamp: new Date((baseEpoch + 260 * 60) * 1000).toISOString(),
    source: "snapshot-live",
  };
}

async function installChartFlowMocks(page: import("@playwright/test").Page): Promise<void> {
  const candles = buildCandles();

  await page.route("**/api/sim/init", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        simulation: {
          candles,
          totalCandles: candles.length,
          currentIndex: candles.length - 1,
          isPlaying: false,
          playSpeed: 1,
        },
        portfolio: {
          balance: 100000,
          currency: "USD",
          holdings: [],
        },
        trades: [],
        source: "fallback",
      }),
    });
  });

  await page.route("**/api/screener/symbol/**", async (route) => {
    const symbol = route.request().url().split("/").pop()?.toUpperCase() || "AAPL";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        symbol,
        fullSymbol: `${symbol}:NASDAQ`,
        name: `${symbol} Incorporated`,
        exchange: "NASDAQ",
        country: "US",
        type: "stock",
        currency: "USD",
        iconUrl: "",
        companyDomain: "example.com",
        marketCap: 1234000000000,
        volume: 1200000,
        sector: "Technology",
        source: "mock",
        popularity: 1,
        isSynthetic: false,
        price: 201.35,
        change: 1.45,
        changePercent: 0.72,
        pe: 21.4,
        eps: 9.1,
        epsGrowth: 0.08,
        dividendYield: 0.6,
        netIncome: 11200000000,
        revenue: 56000000000,
        sharesFloat: 220000000,
        beta: 1.1,
        revenueGrowth: 0.1,
        roe: 0.18,
        avgVolume: 1400000,
        analystRating: "Buy",
        logoSource: "mock",
        isPrimaryListing: true,
        relVolume: 1.1,
        epsDilTtm: 9.1,
        epsDilGrowth: 0.06,
        divYieldPercent: 0.6,
        perfPercent: 0.72,
        peg: 1.8,
        recentEarningsDate: "2026-01-15",
        upcomingEarningsDate: "2026-07-15",
        marketClass: "stock",
      }),
    });
  });

  await page.route("**/api/live/snapshot/public", async (route) => {
    const body = route.request().postDataJSON() as { symbols?: string[]; candleSymbols?: string[] } | null;
    const symbols = body?.symbols?.map((value) => value.toUpperCase()) ?? ["AAPL"];
    const candleSymbols = body?.candleSymbols?.map((value) => value.toUpperCase()) ?? symbols;

    const quotes = Object.fromEntries(symbols.map((symbol, index) => [symbol, buildQuote(symbol, index)]));
    const candlesBySymbol = Object.fromEntries(candleSymbols.map((symbol) => [symbol, candles]));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        quotes,
        candlesBySymbol,
        generatedAt: new Date().toISOString(),
        source: "snapshot-live",
      }),
    });
  });

  await page.route("**/api/portfolio", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

test("symbol page opens fullscreen chart with tools", async ({ page }) => {
  await installChartFlowMocks(page);
  await bootstrapAuthenticatedSession(page);

  await page.goto(`${baseUrl}/symbol/AAPL`);
  await expect(page).toHaveURL(/\/symbol\/AAPL/);
  await expect(page.getByTestId("symbol-open-full-chart")).toBeVisible();

  await page.getByTestId("symbol-open-full-chart").click();

  await expect(page).toHaveURL(/\/simulation\?.*symbol=AAPL/);
  await expect(page).toHaveURL(/\/simulation\?.*layout=chart/);
  await expect(page.getByTestId("simulation-full-chart")).toBeVisible();

  await expect(page.getByTestId("chart-type-candlestick")).toBeVisible();
  await expect(page.getByTestId("tool-group-trend")).toBeVisible();

  const trendTool = page.getByTestId("tool-trend");
  if (await trendTool.count() === 0) {
    await page.getByTestId("tool-group-trend").click();
  }

  await expect(trendTool).toBeVisible();
  await expect(page.getByTestId("drawing-badge")).toContainText("AAPL");
});
