import type { AssetSearchItem } from "@/lib/assetSearch";
import { resolveAssetIcons } from "@/utils/iconResolver";

type KnownCategory = AssetSearchItem["category"];

const STOCK_SECTORS = [
  "commercial_services",
  "communications",
  "consumer_durables",
  "consumer_non_durables",
  "consumer_services",
  "distribution_services",
  "electronic_technology",
  "energy_minerals",
  "finance",
  "government_sector",
  "health_services",
  "health_technology",
  "industrial_services",
  "miscellaneous",
  "non_energy_minerals",
  "process_industries",
  "producer_manufacturing",
  "retail_trade",
  "technology_services",
  "transportation",
  "utilities",
] as const;

function inferCategory(item: AssetSearchItem): KnownCategory {
  const category = (item.category || "").toLowerCase();
  if (category === "stocks" || category === "funds" || category === "futures" || category === "forex" || category === "crypto" || category === "indices" || category === "bonds" || category === "economy" || category === "options") {
    return category;
  }

  const symbol = (item.symbol || item.ticker || "").toUpperCase();
  const name = (item.name || "").toUpperCase();
  const exchange = (item.exchange || "").toUpperCase();
  const instrumentType = (item.instrumentType || item.type || "").toLowerCase();

  if (instrumentType === "derivative" || exchange === "OPT" || /-\d{6}-[CP]-/.test(symbol) || /\b(OPTION|CALL|PUT)\b/.test(name)) {
    return "options";
  }

  if (instrumentType === "derivative" || symbol.includes("-FUT") || symbol.includes("-PERP") || /\b(FUTURE|FUTURES|PERP|PERPETUAL)\b/.test(name)) {
    return "futures";
  }

  if (exchange === "BINANCE" || exchange === "CRYPTO" || exchange === "GLOBAL" || symbol.includes("USDT") || symbol.startsWith("BTC")) {
    return "crypto";
  }

  if (exchange === "FOREX" || exchange === "FX" || symbol.endsWith("INR") || symbol.endsWith("USD")) {
    return "forex";
  }

  if (instrumentType === "etf") {
    return "funds";
  }

  if (instrumentType === "index") {
    if (/\b(GDP|INFLATION|CPI|PMI|UNEMPLOYMENT|INTEREST RATE|MANUFACTURING|CONSUMER)\b/.test(name)) {
      return "economy";
    }
    return "indices";
  }

  return "stocks";
}

function inferStockType(item: AssetSearchItem): { value: string; label: string } {
  const name = (item.name || "").toLowerCase();
  const symbol = (item.symbol || item.ticker || "").toLowerCase();

  if (name.includes("preferred") || symbol.endsWith("p")) return { value: "preferred_stock", label: "Preferred stock" };
  if (name.includes("depositary") || name.includes("depository") || name.includes("adr")) return { value: "depository_receipt", label: "Depository Receipt" };
  if (name.includes("warrant") || symbol.endsWith("w")) return { value: "warrant", label: "Warrant" };
  if (name.includes("pre-ipo") || name.includes("pre ipo")) return { value: "pre_ipo", label: "Pre-IPO" };
  return { value: "common_stock", label: "Common stock" };
}

function inferFundType(item: AssetSearchItem): { value: string; label: string } {
  const name = (item.name || "").toLowerCase();
  if (name.includes("reit")) return { value: "reit", label: "REIT" };
  if (name.includes("trust")) return { value: "trust", label: "Trust" };
  if (name.includes("etf") || name.includes("exchange traded")) return { value: "etf", label: "ETF" };
  return { value: "mutual_fund", label: "Mutual fund" };
}

function inferSector(item: AssetSearchItem): string {
  if (item.sector && item.sector !== "") return item.sector;
  const seed = (item.symbol || item.ticker || item.name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return STOCK_SECTORS[seed % STOCK_SECTORS.length];
}

function categoryMarket(category: KnownCategory): AssetSearchItem["market"] {
  if (category === "stocks") return "Stocks";
  if (category === "funds") return "Funds";
  if (category === "futures") return "Futures";
  if (category === "forex") return "Forex";
  if (category === "crypto") return "Crypto";
  if (category === "indices") return "Indices";
  if (category === "bonds") return "Bonds";
  if (category === "economy") return "Economy";
  return "Options";
}

export function mapSymbolItemToUi(item: AssetSearchItem, requestedCategory?: string): AssetSearchItem {
  const category = inferCategory(item);
  const normalized = {
    ...item,
    logoUrl: item.displayIconUrl || item.logoUrl || item.iconUrl,
  };
  const icons = resolveAssetIcons(normalized);
  const stockType = inferStockType(item);
  const fundType = inferFundType(item);

  const typeValue = category === "stocks"
    ? stockType.value
    : category === "funds"
      ? fundType.value
      : item.type || "";

  const instrumentType = category === "stocks"
    ? stockType.label
    : category === "funds"
      ? fundType.label
      : item.instrumentType || item.type;

  return {
    ...normalized,
    ...icons,
    category,
    assetType: category,
    market: categoryMarket(category),
    type: typeValue,
    instrumentType,
    sector: category === "stocks" ? inferSector(item) : item.sector,
  };
}
