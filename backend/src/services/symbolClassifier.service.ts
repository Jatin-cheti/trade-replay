export type SymbolClass = "company" | "fund" | "forex" | "crypto" | "unknown";

export function classifySymbol(input: { symbol: string; name: string; type?: string; exchange?: string }): SymbolClass {
  const symbol = input.symbol.toUpperCase();
  const name = input.name.toLowerCase();
  const type = (input.type || "").toLowerCase();
  const exchange = (input.exchange || "").toUpperCase();

  const isComplexTicker = /[$]/.test(symbol) || /\.(W|U|A|B|C|D|E|F|G|H)$/i.test(symbol);
  if (isComplexTicker) {
    return "unknown";
  }

  if (type.includes("crypto") || exchange === "BINANCE" || exchange === "CRYPTO") {
    return "crypto";
  }

  if (symbol.includes("INR") || symbol.includes("USD") || exchange === "FOREX" || exchange === "FX") {
    return "forex";
  }

  if (/\betf\b/.test(name) || /\bfund\b/.test(name) || type.includes("fund")) {
    return "fund";
  }

  if (name.includes("ltd") || name.includes("limited") || name.includes("inc") || type.includes("stock")) {
    return "company";
  }

  return "unknown";
}
