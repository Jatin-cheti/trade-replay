/**
 * Logo Pipeline Service — CDN + Compression + Hash Dedup
 *
 * Flow: fetch logo → optimize with sharp → hash dedup → upload S3 → return CDN URL
 */
import { createHash } from "node:crypto";
import { PutObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { getRedisClient } from "../config/redis";

const LOGO_S3_PREFIX = "logos/";
const LOGO_SIZE = 64;
const WEBP_QUALITY = 80;
const FETCH_TIMEOUT_MS = 8000;

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.AWS_REGION || "eu-north-1",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

export interface ProcessedLogo {
  cdnUrl: string;
  hash: string;
  sizeBytes: number;
  reused: boolean;
}

/**
 * Full pipeline: fetch → optimize → dedup → upload → CDN URL
 */
export async function processLogoForCDN(
  sourceUrl: string,
  symbol: string,
): Promise<ProcessedLogo | null> {
  try {
    // 1. Fetch the source image (prefer Google Favicon for reliability)
    let fetchUrl = sourceUrl;
    if (sourceUrl.endsWith(".ico") || sourceUrl.includes("favicon.ico")) {
      // ICO files often fail sharp — use Google Favicons instead
      const domain = new URL(sourceUrl).hostname.replace(/^www\./, "");
      fetchUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
    const buffer = await fetchImage(fetchUrl);
    if (!buffer || buffer.length < 100) {
      return null; // Too small / empty
    }

    // 2. Optimize: resize to 64x64 webp
    const optimized = await sharp(buffer)
      .resize(LOGO_SIZE, LOGO_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    // 3. Hash for dedup
    const hash = createHash("sha256").update(optimized).digest("hex").slice(0, 16);
    const s3Key = `${LOGO_S3_PREFIX}${hash}.webp`;

    // 4. Check Redis cache for existing hash
    const redis = getRedisClient();
    const cached = await redis.get(`logo:hash:${hash}`);
    if (cached) {
      return {
        cdnUrl: cached,
        hash,
        sizeBytes: optimized.length,
        reused: true,
      };
    }

    // 5. Check if already exists in S3
    const exists = await s3ObjectExists(s3Key);
    const cdnUrl = `${env.AWS_CDN_BASE_URL}/${s3Key}`;

    if (!exists) {
      // 6. Upload to S3
      await getS3().send(
        new PutObjectCommand({
          Bucket: env.AWS_S3_BUCKET,
          Key: s3Key,
          Body: optimized,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    }

    // 7. Cache the mapping in Redis (30 days)
    await redis.set(`logo:hash:${hash}`, cdnUrl, "EX", 2592000);
    await redis.set(`logo:${symbol}`, cdnUrl, "EX", 2592000);

    return {
      cdnUrl,
      hash,
      sizeBytes: optimized.length,
      reused: exists,
    };
  } catch (err: any) {
    logger.warn("logo_cdn_pipeline_failed", {
      symbol,
      sourceUrl,
      error: err.message,
    });
    return null;
  }
}

/**
 * Batch process logos through CDN pipeline.
 */
export async function batchProcessLogos(
  assets: Array<{ symbol: string; iconUrl: string }>,
  concurrency = 5,
): Promise<Map<string, ProcessedLogo>> {
  const results = new Map<string, ProcessedLogo>();
  const chunks = chunkArray(assets, concurrency);

  for (const chunk of chunks) {
    const promises = chunk.map(async (asset) => {
      if (!asset.iconUrl) return;
      const result = await processLogoForCDN(asset.iconUrl, asset.symbol);
      if (result) {
        results.set(asset.symbol, result);
      }
    });
    await Promise.all(promises);
    // Yield to event loop
    await new Promise(setImmediate);
  }

  return results;
}

/**
 * Get CDN URL for a symbol from Redis cache.
 */
export async function getCachedLogoUrl(symbol: string): Promise<string | null> {
  const redis = getRedisClient();
  return redis.get(`logo:${symbol}`);
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TradeReplay/1.0" },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

async function s3ObjectExists(key: string): Promise<boolean> {
  try {
    await getS3().send(
      new HeadObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
