const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const RECENT_FAILURE_WINDOW_MS = 30 * 60 * 1000;
const UNRESOLVABLE_RETRY_LIMIT = 6;

export function shouldSkipForNow(input: { retryCount: number; lastAttemptFailedAt?: Date | string | null; now?: Date }): boolean {
  const now = input.now ?? new Date();
  const failedAt = input.lastAttemptFailedAt ? new Date(input.lastAttemptFailedAt) : null;
  if (!failedAt) return false;

  const failedRecently = now.getTime() - failedAt.getTime() <= RECENT_FAILURE_WINDOW_MS;
  return input.retryCount >= 2 && failedRecently;
}

export function nextRetryAt(input: { now?: Date }): Date {
  const now = input.now ?? new Date();
  return new Date(now.getTime() + SIX_HOURS_MS);
}

export function shouldMarkUnresolvable(input: { retryCount: number; hasDomain: boolean; hasLogo: boolean }): boolean {
  return input.retryCount >= UNRESOLVABLE_RETRY_LIMIT && !input.hasDomain && !input.hasLogo;
}

export function getCooldownMs(): number {
  return SIX_HOURS_MS;
}
