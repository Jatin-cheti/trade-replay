import {
  type RawSymbol,
  type ExpansionResult,
  fetchJson,
  fetchText,
  deriveCountry,
  deriveCurrency,
  inferType,
  upsertToGlobalMaster,
} from "./symbolExpansion.helpers";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// -- Source: OKX Exchange -------------------------------------------------

export async function expandOkx(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const data = await fetchJson<{ data?: Array<{ instId: string; baseCcy: string; quoteCcy: string; state: string }> }>(
      "https://www.okx.com/api/v5/public/instruments?instType=SPOT",
    );
    const symbols: RawSymbol[] = (data.data ?? [])
      .filter((row) => row.state === "live")
      .map((row) => ({
        symbol: row.instId.replace("-", "").toUpperCase(),
        fullSymbol: `OKX:${row.instId.replace("-", "").toUpperCase()}`,
        name: `${row.baseCcy}/${row.quoteCcy}`,
        exchange: "OKX",
        country: "GLOBAL",
        type: "crypto",
        currency: row.quoteCcy.toUpperCase(),
        source: "okx",
        metadata: { baseAsset: row.baseCcy, quoteAsset: row.quoteCcy },
      }));
    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "okx", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_okx_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "okx", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// -- Source: Bybit Exchange -----------------------------------------------

export async function expandBybit(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const data = await fetchJson<{ result?: { list?: Array<{ symbol: string; baseCoin: string; quoteCoin: string; status: string }> } }>(
      "https://api.bybit.com/v5/market/instruments-info?category=spot",
    );
    const symbols: RawSymbol[] = (data.result?.list ?? [])
      .filter((row) => row.status === "Trading")
      .map((row) => ({
        symbol: row.symbol.toUpperCase(),
        fullSymbol: `BYBIT:${row.symbol.toUpperCase()}`,
        name: `${row.baseCoin}/${row.quoteCoin}`,
        exchange: "BYBIT",
        country: "GLOBAL",
        type: "crypto",
        currency: row.quoteCoin.toUpperCase(),
        source: "bybit",
        metadata: { baseAsset: row.baseCoin, quoteAsset: row.quoteCoin },
      }));
    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "bybit", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_bybit_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "bybit", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// -- Source: Gate.io Exchange -----------------------------------------------

export async function expandGateio(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const pairs = await fetchJson<Array<{ id: string; base: string; quote: string; trade_status: string }>>(
      "https://api.gateio.ws/api/v4/spot/currency_pairs",
    );
    const symbols: RawSymbol[] = pairs
      .filter((p) => p.trade_status === "tradable")
      .map((p) => ({
        symbol: p.id.replace("_", "").toUpperCase(),
        fullSymbol: `GATEIO:${p.id.replace("_", "").toUpperCase()}`,
        name: `${p.base}/${p.quote}`,
        exchange: "GATEIO",
        country: "GLOBAL",
        type: "crypto",
        currency: p.quote.toUpperCase(),
        source: "gateio",
        metadata: { baseAsset: p.base, quoteAsset: p.quote },
      }));
    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "gateio", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_gateio_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "gateio", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// -- Source: KuCoin Exchange -----------------------------------------------

export async function expandKucoin(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const data = await fetchJson<{ data?: Array<{ symbol: string; baseCurrency: string; quoteCurrency: string; enableTrading: boolean; name: string }> }>(
      "https://api.kucoin.com/api/v1/symbols",
    );
    const symbols: RawSymbol[] = (data.data ?? [])
      .filter((row) => row.enableTrading)
      .map((row) => ({
        symbol: row.symbol.replace("-", "").toUpperCase(),
        fullSymbol: `KUCOIN:${row.symbol.replace("-", "").toUpperCase()}`,
        name: row.name || `${row.baseCurrency}/${row.quoteCurrency}`,
        exchange: "KUCOIN",
        country: "GLOBAL",
        type: "crypto",
        currency: row.quoteCurrency.toUpperCase(),
        source: "kucoin",
        metadata: { baseAsset: row.baseCurrency, quoteAsset: row.quoteCurrency },
      }));
    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "kucoin", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_kucoin_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "kucoin", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// -- Source: MEXC Exchange -----------------------------------------------

export async function expandMexc(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const data = await fetchJson<{ symbols?: Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }> }>(
      "https://api.mexc.com/api/v3/exchangeInfo",
    );
    const symbols: RawSymbol[] = (data.symbols ?? [])
      .filter((row) => row.status === "1" || row.status === "ENABLED")
      .map((row) => ({
        symbol: row.symbol.toUpperCase(),
        fullSymbol: `MEXC:${row.symbol.toUpperCase()}`,
        name: `${row.baseAsset}/${row.quoteAsset}`,
        exchange: "MEXC",
        country: "GLOBAL",
        type: "crypto",
        currency: row.quoteAsset.toUpperCase(),
        source: "mexc",
        metadata: { baseAsset: row.baseAsset, quoteAsset: row.quoteAsset },
      }));
    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "mexc", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_mexc_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "mexc", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// -- Source: Bitfinex Exchange -----------------------------------------------

export async function expandBitfinex(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const data = await fetchJson<string[][]>(
      "https://api-pub.bitfinex.com/v2/conf/pub:list:pair:exchange",
    );
    const pairs = data[0] ?? [];
    const symbols: RawSymbol[] = pairs.map((pair) => ({
      symbol: pair.toUpperCase(),
      fullSymbol: `BITFINEX:${pair.toUpperCase()}`,
      name: pair.length === 6 ? `${pair.slice(0, 3)}/${pair.slice(3)}` : pair,
      exchange: "BITFINEX",
      country: "GLOBAL",
      type: "crypto",
      currency: pair.length >= 6 ? pair.slice(-3).toUpperCase() : "USD",
      source: "bitfinex",
    }));
    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "bitfinex", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_bitfinex_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "bitfinex", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// -- Source: Alpha Vantage Listing Status ------------------------------------

export async function expandAlphaVantageListing(): Promise<ExpansionResult> {
  const start = Date.now();
  const key = env.ALPHA_VANTAGE_KEY;
  if (!key) return { source: "alphavantage-listing", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 0, durationMs: 0 };

  try {
    const csv = await fetchText(`https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${encodeURIComponent(key)}`);
    const lines = csv.split("\n").slice(1);
    const symbols: RawSymbol[] = [];

    for (const line of lines) {
      const cols = line.split(",");
      if (cols.length < 6) continue;
      const [symbol, name, exchange, assetType, , status] = cols;
      if (!symbol || !name || status?.trim() === "Delisted") continue;

      const ex = (exchange || "NYSE").toUpperCase();
      const country = deriveCountry(ex);
      symbols.push({
        symbol: symbol.toUpperCase(),
        fullSymbol: `${ex}:${symbol.toUpperCase()}`,
        name,
        exchange: ex,
        country,
        type: inferType(assetType, name, ex),
        currency: deriveCurrency(country),
        source: "alphavantage-listing",
      });
    }

    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "alphavantage-listing", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_alphavantage_listing_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "alphavantage-listing", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// -- Source: Huobi/HTX Exchange -----------------------------------------------

export async function expandHuobi(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const data = await fetchJson<{ data?: Array<{ symbol: string; "base-currency": string; "quote-currency": string; state: string }> }>(
      "https://api.huobi.pro/v1/common/symbols",
    );
    const symbols: RawSymbol[] = (data.data ?? [])
      .filter((row) => row.state === "online")
      .map((row) => ({
        symbol: row.symbol.toUpperCase(),
        fullSymbol: `HUOBI:${row.symbol.toUpperCase()}`,
        name: `${row["base-currency"]}/${row["quote-currency"]}`,
        exchange: "HUOBI",
        country: "GLOBAL",
        type: "crypto",
        currency: row["quote-currency"].toUpperCase(),
        source: "huobi",
        metadata: { baseAsset: row["base-currency"], quoteAsset: row["quote-currency"] },
      }));
    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "huobi", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_huobi_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "huobi", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}

// -- Source: Crypto.com Exchange -----------------------------------------------

export async function expandCryptoCom(): Promise<ExpansionResult> {
  const start = Date.now();
  try {
    const data = await fetchJson<{ result?: { instruments?: Array<{ symbol: string; base_currency: string; quote_currency: string }> } }>(
      "https://api.crypto.com/exchange/v1/public/get-instruments",
    );
    const symbols: RawSymbol[] = (data.result?.instruments ?? [])
      .map((row) => ({
        symbol: row.symbol.replace("_", "").toUpperCase(),
        fullSymbol: `CRYPTOCOM:${row.symbol.replace("_", "").toUpperCase()}`,
        name: `${row.base_currency}/${row.quote_currency}`,
        exchange: "CRYPTOCOM",
        country: "GLOBAL",
        type: "crypto",
        currency: row.quote_currency.toUpperCase(),
        source: "crypto-com",
        metadata: { baseAsset: row.base_currency, quoteAsset: row.quote_currency },
      }));
    const { inserted, skipped } = await upsertToGlobalMaster(symbols);
    return { source: "crypto-com", fetched: symbols.length, newInserted: inserted, existingSkipped: skipped, errors: 0, durationMs: Date.now() - start };
  } catch (error) {
    logger.warn("expansion_cryptocom_failed", { error: error instanceof Error ? error.message : String(error) });
    return { source: "crypto-com", fetched: 0, newInserted: 0, existingSkipped: 0, errors: 1, durationMs: Date.now() - start };
  }
}