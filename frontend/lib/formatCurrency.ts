/**
 * formatCurrency — Section 7.2 of corrective execution prompt.
 *
 * Rules:
 *  - INR: lakh / crore suffix system (e.g. ₹1.23 L, ₹5.6 Cr, ₹1.2 K Cr).
 *  - All other currencies: K / M / B / T suffix system.
 *  - null / undefined / NaN / Infinity  → "—" (en-dash).
 *  - Locale: "en-IN" for INR, "en-US" otherwise.
 *  - Always prefixes the currency symbol (₹, $, €, £, ¥ …); unknown codes
 *    fall back to the ISO code + space.
 *  - Precision defaults to 2 decimal places, caller can override.
 */

export type FormatCurrencyOptions = {
  currency?: string;   // ISO 4217; default "INR"
  precision?: number;  // default 2
  fallback?: string;   // default "—"
};

const NBSP = "\u00A0";

const SYMBOL_BY_CODE: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  HKD: "HK$",
};

function isBlankNumber(v: unknown): boolean {
  return v === null || v === undefined || typeof v !== "number" || !Number.isFinite(v);
}

function symbolFor(code: string): string {
  return SYMBOL_BY_CODE[code] ?? `${code}${NBSP}`;
}

function formatINR(value: number, precision: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const sym = symbolFor("INR");
  if (abs < 1_000) return `${sign}${sym}${abs.toFixed(precision)}`;
  if (abs < 1_00_000) return `${sign}${sym}${(abs / 1_000).toFixed(precision)}${NBSP}K`;
  if (abs < 1_00_00_000) return `${sign}${sym}${(abs / 1_00_000).toFixed(precision)}${NBSP}L`;
  if (abs < 1_00_00_00_00_000) return `${sign}${sym}${(abs / 1_00_00_000).toFixed(precision)}${NBSP}Cr`;
  // Above 1 lakh crore → use "K Cr"
  return `${sign}${sym}${(abs / 1_00_00_00_00_000).toFixed(precision)}${NBSP}K${NBSP}Cr`;
}

function formatWestern(value: number, code: string, precision: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const sym = symbolFor(code);
  if (abs < 1_000) return `${sign}${sym}${abs.toFixed(precision)}`;
  if (abs < 1_000_000) return `${sign}${sym}${(abs / 1_000).toFixed(precision)}${NBSP}K`;
  if (abs < 1_000_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(precision)}${NBSP}M`;
  if (abs < 1_000_000_000_000) return `${sign}${sym}${(abs / 1_000_000_000).toFixed(precision)}${NBSP}B`;
  return `${sign}${sym}${(abs / 1_000_000_000_000).toFixed(precision)}${NBSP}T`;
}

export function formatCurrency(value: number | null | undefined, opts: FormatCurrencyOptions = {}): string {
  const { currency = "INR", precision = 2, fallback = "—" } = opts;
  if (isBlankNumber(value)) return fallback;
  const code = currency.toUpperCase();
  return code === "INR"
    ? formatINR(value as number, precision)
    : formatWestern(value as number, code, precision);
}

export default formatCurrency;
