/**
 * @tradereplay/charts — Timezone Utilities
 *
 * Provides proper IANA timezone support using `luxon`.
 * Replaces all hardcoded IST offsets (19800) and manual UTC arithmetic scattered
 * throughout the codebase.
 *
 * @example
 * ```ts
 * import { getMarketTimezone, formatBarTime, applyMarketTimezone } from '@tradereplay/charts';
 *
 * const tz  = getMarketTimezone('NSE');              // 'Asia/Kolkata'
 * const iso = formatBarTime(unixSec, '5', tz);       // '09:15 Apr 24'
 * const adj = applyMarketTimezone(unixSec, 'NSE');   // unix adjusted to IST wall-clock
 * ```
 */

import { DateTime } from 'luxon';

// ─── Exchange → IANA timezone map ────────────────────────────────────────────

/**
 * Maps exchange/market codes to their canonical IANA timezone identifier.
 * Add new exchanges here as the platform expands.
 */
export const MARKET_TIMEZONE_MAP: Record<string, string> = {
  // India
  NSE:    'Asia/Kolkata',
  BSE:    'Asia/Kolkata',
  NFO:    'Asia/Kolkata',
  MCX:    'Asia/Kolkata',
  // US
  NYSE:   'America/New_York',
  NASDAQ: 'America/New_York',
  AMEX:   'America/New_York',
  CBOE:   'America/New_York',
  CME:    'America/Chicago',
  // Europe
  LSE:    'Europe/London',
  XLON:   'Europe/London',
  EURONEXT: 'Europe/Paris',
  XPAR:   'Europe/Paris',
  XFRA:   'Europe/Berlin',
  FSE:    'Europe/Berlin',
  SIX:    'Europe/Zurich',
  // Asia-Pacific
  TSE:    'Asia/Tokyo',
  OSE:    'Asia/Tokyo',
  HKEX:   'Asia/Hong_Kong',
  SSE:    'Asia/Shanghai',
  SZSE:   'Asia/Shanghai',
  SGX:    'Asia/Singapore',
  ASX:    'Australia/Sydney',
  NZX:    'Pacific/Auckland',
  KRX:    'Asia/Seoul',
  // Middle East / Africa
  TADAWUL: 'Asia/Riyadh',
  DFM:    'Asia/Dubai',
  ADX:    'Asia/Dubai',
  JSE:    'Africa/Johannesburg',
  // Americas
  B3:     'America/Sao_Paulo',
  BMV:    'America/Mexico_City',
  TSX:    'America/Toronto',
  // Global / crypto (UTC)
  CRYPTO: 'UTC',
  FOREX:  'UTC',
  OANDA:  'UTC',
  GLOBAL: 'UTC',
};

/**
 * Returns the IANA timezone for a given exchange code.
 * Falls back to `'UTC'` for unknown exchanges.
 */
export function getMarketTimezone(exchange: string): string {
  return MARKET_TIMEZONE_MAP[exchange?.toUpperCase()] ?? 'UTC';
}

// ─── IST helpers (backward compat) ───────────────────────────────────────────

/**
 * Returns the current UTC offset in **seconds** for IST (Asia/Kolkata).
 * Replaces all hardcoded `IST_OFFSET_S = 19800` constants.
 * Uses luxon to correctly handle DST (India doesn't observe DST but this is correct for all zones).
 */
export function getISTOffsetSeconds(): number {
  return getTimezoneOffsetSeconds('Asia/Kolkata');
}

/**
 * Returns the UTC offset in **seconds** for any IANA timezone.
 * Positive = ahead of UTC (e.g. IST = +19800), negative = behind (e.g. EST = -18000).
 */
export function getTimezoneOffsetSeconds(ianaZone: string): number {
  const dt = DateTime.now().setZone(ianaZone);
  return dt.isValid ? dt.offset * 60 : 0;
}

// ─── Timestamp conversion ─────────────────────────────────────────────────────

/**
 * Adjusts a UTC unix timestamp (seconds) so that when the chart library renders it
 * as a "UTC wall-clock" time, it displays the correct local market time.
 *
 * The chart library always treats timestamps as UTC. For intraday bars to show
 * market-local hours (e.g. 09:15 for NSE), we add the market timezone offset.
 *
 * @param unixSec  - UTC unix timestamp in seconds
 * @param exchange - Exchange code (e.g. 'NSE', 'NYSE')
 * @returns Adjusted unix timestamp in seconds
 */
export function applyMarketTimezone(unixSec: number, exchange: string): number {
  const tz = getMarketTimezone(exchange);
  return unixSec + getTimezoneOffsetSeconds(tz);
}

/**
 * Converts a unix timestamp from one timezone to another.
 *
 * @param unixSec  - Unix timestamp in seconds
 * @param fromTz   - Source IANA timezone (e.g. 'UTC')
 * @param toTz     - Target IANA timezone (e.g. 'Asia/Kolkata')
 * @returns Adjusted unix timestamp in seconds
 */
export function convertTimezone(unixSec: number, fromTz: string, toTz: string): number {
  const fromOffset = getTimezoneOffsetSeconds(fromTz);
  const toOffset   = getTimezoneOffsetSeconds(toTz);
  return unixSec - fromOffset + toOffset;
}

// ─── Bar time formatting ──────────────────────────────────────────────────────

/**
 * Formats a bar timestamp for display in chart tooltips / crosshair labels.
 *
 * @param unixSec    - Unix timestamp in seconds (already in market-local time if applicable)
 * @param resolution - Chart resolution string: '1', '5', '15', '30', '60', '120', 'D', 'W', 'M'
 * @param ianaZone   - IANA timezone for display (defaults to UTC)
 * @returns Human-readable time string appropriate for the resolution
 */
export function formatBarTime(unixSec: number, resolution: string, ianaZone = 'UTC'): string {
  const dt = DateTime.fromSeconds(unixSec, { zone: ianaZone });
  if (!dt.isValid) return '—';

  const isIntraday = !['D', 'W', 'M'].includes(resolution);
  if (isIntraday) {
    // e.g. "09:15" for same-day, "09:15 Apr 24" for cross-day context
    return dt.toFormat('HH:mm');
  }
  if (resolution === 'D') return dt.toFormat('MMM d, yyyy');
  if (resolution === 'W') return `Wk ${dt.toFormat('W, yyyy')}`;
  return dt.toFormat('MMM yyyy');
}

/**
 * Formats a countdown timer for the bar close countdown.
 *
 * @param remainingSeconds - Seconds until bar closes
 * @param resolution       - Chart resolution (determines whether to show hours)
 * @returns Formatted string e.g. "04:32" or "01:04:32"
 */
export function formatCountdown(remainingSeconds: number, resolution: string): string {
  const abs = Math.abs(Math.round(remainingSeconds));
  const h   = Math.floor(abs / 3600);
  const m   = Math.floor((abs % 3600) / 60);
  const s   = abs % 60;

  const isHourly = ['60', '120', 'D', 'W', 'M'].includes(resolution);
  const pad = (n: number) => String(n).padStart(2, '0');

  if (isHourly && h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
