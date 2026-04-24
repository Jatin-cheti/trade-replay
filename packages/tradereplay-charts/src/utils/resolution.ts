/**
 * Resolution utilities — shared across all chart consumers.
 *
 * "Resolution" follows the TradingView UDF convention:
 *   - Pure integer string → minutes  (e.g. "1", "5", "60")
 *   - "D" / "1d"         → daily
 *   - "W" / "1w"         → weekly
 *   - "M" / "1m"         → monthly
 *   - Optional unit suffix: "15m", "2h", "3d", "1w"
 */

/** Convert a resolution string to candle duration in seconds. */
export function resolutionToSeconds(res: string | undefined): number {
  if (!res) return 60;
  const normalized = res.trim();
  if (!normalized) return 60;
  if (normalized === 'D' || normalized.toLowerCase() === '1d') return 86400;
  if (normalized === 'W' || normalized.toLowerCase() === '1w') return 7 * 86400;
  if (normalized === 'M' || normalized.toLowerCase() === '1m') return 30 * 86400;

  const unitMatch = normalized.match(/^(\d+)\s*([mhdw])$/i);
  if (unitMatch) {
    const amount = Number.parseInt(unitMatch[1], 10);
    const unit = unitMatch[2].toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0) return 60;
    if (unit === 'm') return amount * 60;
    if (unit === 'h') return amount * 3600;
    if (unit === 'd') return amount * 86400;
    if (unit === 'w') return amount * 7 * 86400;
  }

  const n = parseInt(normalized, 10);
  return Number.isFinite(n) && n > 0 ? n * 60 : 60;
}

/** Returns true when the resolution maps to an intraday timeframe (sub-daily). */
export function isIntradayResolution(res: string | undefined): boolean {
  if (!res) return true;
  if (res === 'D' || res === 'W' || res === 'M') return false;
  const n = parseInt(res, 10);
  return Number.isFinite(n) && n > 0;
}

/**
 * Format a countdown in seconds.
 * - Intraday (forceHours=false, < 1 h):   MM:SS
 * - Hourly+  (forceHours=true):            HH:MM:SS
 * - Multi-day:                             DD:HH:MM:SS
 */
export function formatCountdown(seconds: number, forceHours: boolean): string {
  const s = Math.max(0, seconds);
  const totalDays = Math.floor(s / 86400);
  const totalHours = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const dd = String(totalDays).padStart(2, '0');
  const hh = String(totalHours).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  if (totalDays > 0) return `${dd}:${hh}:${mm}:${ss}`;
  if (forceHours) return `${hh}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}
