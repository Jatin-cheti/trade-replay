/**
 * apiKeyManager.service.ts — Round-robin FMP API key rotation for rate-limit safety.
 */

const FMP_KEYS: string[] = [
  process.env.FMP_API_KEY,
  process.env.FMP_KEY_1,
  process.env.FMP_KEY_2,
  process.env.FMP_KEY_3,
  process.env.FMP_KEY_4,
].filter((k): k is string => !!k && k.length > 5);

let fmpIndex = 0;

/** Get the next FMP API key in round-robin rotation */
export function getFmpKey(): string | null {
  if (FMP_KEYS.length === 0) return null;
  const key = FMP_KEYS[fmpIndex % FMP_KEYS.length];
  fmpIndex = (fmpIndex + 1) % FMP_KEYS.length;
  return key;
}

/** Total number of available FMP keys */
export function getFmpKeyCount(): number {
  return FMP_KEYS.length;
}
