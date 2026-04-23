/**
 * @tradereplay/charts — Currency Utilities
 *
 * Provides real-time currency exchange rates via the free ExchangeRate-API
 * (`open.er-api.com/v6/latest/USD`). Replaces all hardcoded `FX_RATES` constants
 * and the static `USD_TO_INR = 83.5` backend config.
 *
 * @example
 * ```ts
 * import { fetchExchangeRates, convertCurrency, formatPrice } from '@tradereplay/charts';
 *
 * const rates = await fetchExchangeRates();             // cached for 1 hour
 * const inr   = convertCurrency(100, 'USD', 'INR', rates); // e.g. 8350
 * const label = formatPrice(8350, 'INR');               // '₹8,350.00'
 * ```
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** ISO 4217 currency symbols for display. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',   EUR: '€',  GBP: '£',   JPY: '¥',   INR: '₹',
  AUD: 'A$',  CAD: 'C$', CHF: 'Fr',  CNY: '¥',   HKD: 'HK$',
  SGD: 'S$',  KRW: '₩',  BRL: 'R$',  MXN: 'MX$', SEK: 'kr',
  NOK: 'kr',  DKK: 'kr', NZD: 'NZ$', ZAR: 'R',   RUB: '₽',
  TRY: '₺',   SAR: 'SR', AED: 'د.إ', ILS: '₪',   PLN: 'zł',
  THB: '฿',   IDR: 'Rp', MYR: 'RM',  PHP: '₱',   CZK: 'Kč',
};

/** Number of decimal places to use when formatting each currency. */
const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0, KRW: 0, IDR: 0, BRL: 0,
};

/** Default fallback rates (used when the fetch fails, e.g. SSR / offline). */
export const DEFAULT_FX_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.78, JPY: 151.2, INR: 83.5,
  AUD: 1.53, CAD: 1.36, CHF: 0.91, CNY: 7.24, HKD: 7.82,
  SGD: 1.34, KRW: 1330, BRL: 5.05, MXN: 17.2, SEK: 10.5,
  NOK: 10.7, DKK: 6.88, NZD: 1.63, ZAR: 18.6, SAR: 3.75,
  AED: 3.67,
};

// ─── Cache ────────────────────────────────────────────────────────────────────

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
  base: string;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour cache
const _cache: Record<string, RatesCache> = {};

// ─── fetchExchangeRates ───────────────────────────────────────────────────────

/**
 * Fetches live exchange rates from `open.er-api.com`.
 * - Free to use, no API key required.
 * - Updates daily on their end; we cache locally for 1 hour.
 * - Falls back to `DEFAULT_FX_RATES` on network error.
 *
 * @param base - Base currency (default `'USD'`). All returned rates are relative to this.
 * @returns `{ USD: 1, EUR: 0.92, INR: 84.3, ... }`
 */
export async function fetchExchangeRates(base = 'USD'): Promise<Record<string, number>> {
  const now = Date.now();
  const cached = _cache[base];
  if (cached && now - cached.fetchedAt < TTL_MS) {
    return cached.rates;
  }

  try {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json() as {
      result: string;
      rates: Record<string, number>;
      base_code?: string;
    };

    if (data.result !== 'success' || !data.rates) {
      throw new Error('Unexpected API response structure');
    }

    const rates = { ...DEFAULT_FX_RATES, ...data.rates };
    _cache[base] = { rates, fetchedAt: now, base };
    return rates;
  } catch (err) {
    // Non-throwing fallback: return defaults so the UI still renders
    console.warn('[tradereplay/charts] Currency fetch failed, using defaults:', err);
    return { ...DEFAULT_FX_RATES };
  }
}

/**
 * Forces the cache to expire so the next `fetchExchangeRates` call hits the API.
 * Useful in tests or when you know rates are stale.
 */
export function invalidateRatesCache(base?: string): void {
  if (base) {
    delete _cache[base];
  } else {
    Object.keys(_cache).forEach((k) => delete _cache[k]);
  }
}

// ─── convertCurrency ─────────────────────────────────────────────────────────

/**
 * Converts `amount` from one currency to another using the provided rate table.
 *
 * @param amount - The value to convert (e.g. `100`)
 * @param from   - Source currency ISO code (e.g. `'USD'`)
 * @param to     - Target currency ISO code (e.g. `'INR'`)
 * @param rates  - Rate table where keys are ISO codes and values are rates relative to the base
 * @returns Converted amount (not rounded — use `formatPrice` for display)
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  if (from === to) return amount;

  const fromRate = rates[from];
  const toRate   = rates[to];

  if (!fromRate || !toRate) {
    console.warn(`[tradereplay/charts] Unknown currency: ${!fromRate ? from : to}`);
    return amount;
  }

  // Convert: amount → USD (divide by fromRate) → target (multiply by toRate)
  return (amount / fromRate) * toRate;
}

// ─── formatPrice ─────────────────────────────────────────────────────────────

export interface FormatPriceOptions {
  /** When true, uses compact notation: 1,234,567 → '1.23M'. Default: false. */
  compact?: boolean;
  /** Override decimal places (otherwise uses CURRENCY_DECIMALS or 2). */
  decimals?: number;
  /** BCP 47 locale string. Defaults to `'en-IN'` for INR, `'en-US'` for others. */
  locale?: string;
  /** When true, prepends the currency symbol character instead of using Intl notation. Default: false. */
  symbolPrefix?: boolean;
}

/**
 * Formats a price for display, using `Intl.NumberFormat` for locale-aware formatting.
 *
 * @example
 * ```ts
 * formatPrice(8350.25, 'INR')               // '₹8,350.25'
 * formatPrice(1234567, 'USD', { compact: true }) // '$1.23M'
 * formatPrice(1500000, 'JPY')               // '¥1,500,000'
 * ```
 */
export function formatPrice(
  value: number,
  currency: string,
  options: FormatPriceOptions = {},
): string {
  const { compact = false, decimals, locale, symbolPrefix = false } = options;

  const defaultDecimals = CURRENCY_DECIMALS[currency] ?? 2;
  const fractionDigits  = decimals ?? defaultDecimals;
  const resolvedLocale  = locale ?? (currency === 'INR' ? 'en-IN' : 'en-US');

  try {
    const notation = compact ? ('compact' as const) : ('standard' as const);
    const formatter = new Intl.NumberFormat(resolvedLocale, {
      style: symbolPrefix ? 'decimal' : 'currency',
      currency: symbolPrefix ? undefined : currency,
      currencyDisplay: 'symbol',
      notation,
      minimumFractionDigits: compact ? 0 : fractionDigits,
      maximumFractionDigits: compact ? 2 : fractionDigits,
    });

    const formatted = formatter.format(value);
    return symbolPrefix ? `${CURRENCY_SYMBOLS[currency] ?? currency}${formatted}` : formatted;
  } catch {
    // Fallback for environments where Intl.NumberFormat doesn't support all currencies
    const sym = CURRENCY_SYMBOLS[currency] ?? currency;
    return `${sym}${value.toFixed(fractionDigits)}`;
  }
}

/**
 * Returns the symbol character for a currency code, e.g. `'$'` for `'USD'`.
 * Falls back to the ISO code if unknown.
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}
