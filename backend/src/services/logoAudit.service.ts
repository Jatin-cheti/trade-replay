/**
 * logoAudit.service.ts — Logo validation with URL + HTTP + image analysis.
 *
 * Three validation tiers:
 * 1. URL pattern check (sync, instant)
 * 2. HTTP HEAD check (content-type, size, reachability)
 * 3. Image content check (dimensions, hash comparison)
 *
 * Audit state stored in Redis sets for reprocessing.
 */
import { redisClient, isRedisReady } from "../config/redis";
import { logger } from "../utils/logger";

/* ── Known Bad Patterns ──────────────────────────────────────────── */

const PLACEHOLDER_DOMAINS = new Set([
  "placehold.it", "placeholder.com", "via.placeholder.com",
  "dummyimage.com", "fakeimg.pl",
]);

const FAVICON_PATTERNS = [
  /\/favicon\.(ico|png|svg|jpg)$/i,
  /\/favicon[-_]?\d*\.(ico|png|svg|jpg)$/i,
  /\/apple-touch-icon/i,
  /favicons?\//i,
];

const GENERIC_PATTERNS = [
  /generic[-_]?logo/i, /default[-_]?(logo|icon|avatar|image)/i,
  /no[-_]?(logo|image|icon)/i, /missing[-_]?(logo|image)/i,
  /placeholder/i, /stock[-_]?photo/i,
];

// Known bad image hashes (1x1 pixel, common placeholder images)
const KNOWN_BAD_HASHES = new Set<string>();

export interface LogoValidation {
  isValid: boolean;
  issues: string[];
  tier: "url" | "http" | "image";
}

/* ── Tier 1: URL-based validation (sync) ─────────────────────────── */

export function validateLogoUrl(url: string): LogoValidation {
  const issues: string[] = [];
  if (!url || url.length === 0) return { isValid: false, issues: ["empty_url"], tier: "url" };
  if (url.startsWith("data:image/svg")) return { isValid: false, issues: ["generated_svg_fallback"], tier: "url" };

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (PLACEHOLDER_DOMAINS.has(hostname)) issues.push("placeholder_domain");
    for (const p of FAVICON_PATTERNS) { if (p.test(path) || p.test(url)) { issues.push("favicon_pattern"); break; } }
    for (const p of GENERIC_PATTERNS) { if (p.test(path)) { issues.push("generic_pattern"); break; } }
    if (path === "/" || path === "/favicon.ico") issues.push("root_favicon");
  } catch {
    issues.push("invalid_url");
  }

  return { isValid: issues.length === 0, issues, tier: "url" };
}

/* ── Tier 2: HTTP HEAD validation (async) ────────────────────────── */

export async function validateLogoHttp(url: string): Promise<LogoValidation> {
  const urlCheck = validateLogoUrl(url);
  if (!urlCheck.isValid) return urlCheck;

  const issues: string[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: { "User-Agent": "TradeReplay-LogoAudit/1.0" },
        redirect: "follow",
      });

      if (!res.ok) return { isValid: false, issues: [`http_${res.status}`], tier: "http" };

      const ct = res.headers.get("content-type") || "";
      const cl = parseInt(res.headers.get("content-length") || "0", 10);

      if (!ct.includes("image/")) issues.push("not_image");
      if (cl > 0 && cl < 200) issues.push("too_small_pixel");
      if (cl > 5_000_000) issues.push("too_large");
      if (ct.includes("x-icon") || ct.includes("/icon")) issues.push("ico_content_type");
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    issues.push("unreachable");
  }

  return { isValid: issues.length === 0, issues, tier: "http" };
}

/* ── Tier 3: Image content validation (async, downloads image) ──── */

export async function validateLogoImage(url: string): Promise<LogoValidation> {
  const httpCheck = await validateLogoHttp(url);
  if (!httpCheck.isValid) return httpCheck;

  const issues: string[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "TradeReplay-LogoAudit/1.0" },
        redirect: "follow",
      });

      if (!res.ok) return { isValid: false, issues: [`http_${res.status}`], tier: "image" };

      const buffer = Buffer.from(await res.arrayBuffer());

      // Size check
      if (buffer.length < 200) {
        issues.push("image_too_small");
      }

      // PNG dimension check (width/height in IHDR chunk at bytes 16-23)
      if (buffer[0] === 0x89 && buffer[1] === 0x50) { // PNG magic
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(18);
        if (width < 16 || height < 16) issues.push("image_tiny_dimensions");
        if (width === 1 && height === 1) issues.push("tracking_pixel");
        if (Math.abs(width - height) > Math.max(width, height) * 0.5) {
          issues.push("image_badly_cropped");
        }
      }

      // Simple hash for known-bad images
      const { createHash } = await import("node:crypto");
      const hash = createHash("md5").update(buffer).digest("hex");
      if (KNOWN_BAD_HASHES.has(hash)) {
        issues.push("known_bad_image_hash");
      }

      // Register hash for future reference if bad
      if (issues.length > 0 && buffer.length < 500) {
        KNOWN_BAD_HASHES.add(hash);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    issues.push("image_download_failed");
  }

  return { isValid: issues.length === 0, issues, tier: "image" };
}

/* ── Redis Audit Tracking ────────────────────────────────────────── */

const SETS = {
  missing: "logo:audit:missing",
  bad: "logo:audit:bad",
  cropped: "logo:audit:cropped",
} as const;

type AuditCategory = keyof typeof SETS;

export async function trackAuditIssue(
  symbol: string, category: AuditCategory, meta: Record<string, unknown>,
): Promise<void> {
  if (!isRedisReady()) return;
  try {
    const pipeline = redisClient.pipeline();
    pipeline.sadd(SETS[category], symbol);
    pipeline.hset(`logo:audit:meta:${symbol}`, {
      ...meta, category, ts: Date.now().toString(),
    });
    await pipeline.exec();
  } catch { /* non-critical */ }
}

export async function clearAuditIssue(symbol: string): Promise<void> {
  if (!isRedisReady()) return;
  try {
    const pipeline = redisClient.pipeline();
    for (const key of Object.values(SETS)) pipeline.srem(key, symbol);
    pipeline.del(`logo:audit:meta:${symbol}`);
    await pipeline.exec();
  } catch { /* ignore */ }
}

export async function getAuditReport(): Promise<{
  missing: number; bad: number; cropped: number; total: number;
}> {
  if (!isRedisReady()) return { missing: 0, bad: 0, cropped: 0, total: 0 };
  try {
    const pipeline = redisClient.pipeline();
    pipeline.scard(SETS.missing);
    pipeline.scard(SETS.bad);
    pipeline.scard(SETS.cropped);
    const results = await pipeline.exec();
    const [missing, bad, cropped] = (results || []).map(r => (r && r[1] as number) || 0);
    return { missing, bad, cropped, total: missing + bad + cropped };
  } catch {
    return { missing: 0, bad: 0, cropped: 0, total: 0 };
  }
}

export async function getAuditSymbols(category: AuditCategory, limit = 100): Promise<string[]> {
  if (!isRedisReady()) return [];
  try {
    return await redisClient.srandmember(SETS[category], limit) as string[];
  } catch {
    return [];
  }
}