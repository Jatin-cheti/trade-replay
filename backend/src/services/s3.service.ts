import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import sharp from "sharp";
import { env } from "../config/env";
import { isRedisReady, redisClient } from "../config/redis";
import { clusterScopedKey } from "./redisKey.service";

const PORTFOLIO_PREFIX = "trade-replay/portfolios";
const LOGO_PREFIX = "trade-replay/logos";
const LOGO_VARIANT_SIZES = [32, 64, 128] as const;
const DEFAULT_LOGO_SIZE = 64;
const MAX_CSV_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_CSV_CONTENT_TYPES = new Set(["text/csv", "application/vnd.ms-excel"]);

const hasAwsConfig = Boolean(
  env.AWS_REGION && env.AWS_S3_BUCKET && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY,
);

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  ensureAwsConfigured();
  if (s3Client) return s3Client;

  s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
}

function ensureAwsConfigured(): void {
  if (!hasAwsConfig) {
    throw new Error("AWS_S3_NOT_CONFIGURED");
  }
}

function sanitizeFileName(fileName: string): string {
  const lower = fileName.trim().toLowerCase();
  const safe = lower.replace(/[^a-z0-9._-]/g, "-");
  return safe.length > 120 ? safe.slice(-120) : safe;
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
}

function resolveCdnUrl(key: string): string {
  const base = env.AWS_CDN_BASE_URL.trim();
  if (base) {
    return `${base.replace(/\/$/, "")}/${key}`;
  }
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}

function buildLogoVariantKey(fullSymbol: string, size: number, versionHash: string): string {
  const safeSymbol = fullSymbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "-");
  return `${LOGO_PREFIX}/${safeSymbol}_v${versionHash}_${size}.png`;
}

function hashLogoVersion(buffer: Buffer): string {
  return crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 12);
}

type LogoCachePayload = {
  defaultKey: string;
  variants: Record<string, string>;
};

function parseLogoCachePayload(raw: string): LogoCachePayload {
  try {
    const parsed = JSON.parse(raw) as Partial<LogoCachePayload>;
    if (parsed.defaultKey && parsed.variants && typeof parsed.variants === "object") {
      return {
        defaultKey: parsed.defaultKey,
        variants: parsed.variants as Record<string, string>,
      };
    }
  } catch {
    // Backward compatibility with old string-only cache values.
  }

  return {
    defaultKey: raw,
    variants: {
      [String(DEFAULT_LOGO_SIZE)]: raw,
    },
  };
}

function buildVariantCdnUrls(keys: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(keys).map(([size, key]) => [size, resolveCdnUrl(key)]));
}

async function optimizeLogoVariants(image: Buffer): Promise<Record<string, Buffer>> {
  const outputEntries = await Promise.all(
    LOGO_VARIANT_SIZES.map(async (size) => {
      const buffer = await sharp(image)
        .rotate()
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({
          quality: 90,
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true,
        })
        .toBuffer();

      return [String(size), buffer] as const;
    }),
  );

  return Object.fromEntries(outputEntries);
}

export function buildPortfolioUploadKey(userId: string, fileName: string): string {
  const safeUserId = sanitizePathSegment(userId);
  const safeName = sanitizeFileName(fileName);
  return `${PORTFOLIO_PREFIX}/${safeUserId}/${Date.now()}-${safeName}`;
}

export function buildPortfolioJsonKey(userId: string, portfolioId: string): string {
  const safeUserId = sanitizePathSegment(userId);
  const safePortfolioId = sanitizePathSegment(portfolioId);
  return `${PORTFOLIO_PREFIX}/${safeUserId}/${safePortfolioId}.json`;
}

function ensureCsvUploadRequest(fileName: string, contentType?: string, fileSizeBytes?: number): void {
  if (!fileName.toLowerCase().endsWith(".csv")) {
    throw new Error("INVALID_FILE_TYPE");
  }

  if (contentType) {
    const normalizedType = contentType.trim().toLowerCase();
    if (!ALLOWED_CSV_CONTENT_TYPES.has(normalizedType)) {
      throw new Error("INVALID_CONTENT_TYPE");
    }
  }

  if (typeof fileSizeBytes === "number") {
    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      throw new Error("INVALID_FILE_SIZE");
    }
    if (fileSizeBytes > MAX_CSV_UPLOAD_BYTES) {
      throw new Error("FILE_TOO_LARGE");
    }
  }
}

export async function generatePortfolioUploadUrl(
  userId: string,
  fileName: string,
  contentType?: string,
  fileSizeBytes?: number,
  portfolioId?: string,
): Promise<{ uploadUrl: string; s3Key: string }> {
  const hasPortfolioId = typeof portfolioId === "string" && portfolioId.trim().length > 0;
  if (!hasPortfolioId) {
    ensureCsvUploadRequest(fileName, contentType, fileSizeBytes);
  }

  const key = hasPortfolioId
    ? buildPortfolioJsonKey(userId, portfolioId as string)
    : buildPortfolioUploadKey(userId, fileName);
  const resolvedContentType = hasPortfolioId
    ? "application/json"
    : (contentType?.trim().toLowerCase() || "text/csv");

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: resolvedContentType,
    ContentLength: fileSizeBytes,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 60 });
  return { uploadUrl, s3Key: key };
}

function assertKeyOwnership(userId: string, key: string): void {
  const normalizedKey = key.trim();
  const expectedPrefix = `${PORTFOLIO_PREFIX}/${sanitizePathSegment(userId)}/`;
  if (!normalizedKey.startsWith(expectedPrefix)) {
    throw new Error("INVALID_S3_KEY_SCOPE");
  }
  if (!normalizedKey.toLowerCase().endsWith(".csv") && !normalizedKey.toLowerCase().endsWith(".json")) {
    throw new Error("INVALID_S3_KEY_SCOPE");
  }
}

function assertKeyOwnershipByExtension(userId: string, key: string, extension: "csv" | "json"): void {
  assertKeyOwnership(userId, key);
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey.endsWith(`.${extension}`)) {
    throw new Error("INVALID_S3_KEY_SCOPE");
  }
}

export async function downloadPortfolioCsv(userId: string, key: string): Promise<string> {
  assertKeyOwnershipByExtension(userId, key, "csv");

  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
  });

  const response = await getS3Client().send(command);
  const body = response.Body;
  if (!body) {
    throw new Error("S3_OBJECT_EMPTY");
  }

  if (typeof (body as { transformToString?: (encoding?: string) => Promise<string> }).transformToString === "function") {
    return (body as { transformToString: (encoding?: string) => Promise<string> }).transformToString("utf-8");
  }

  throw new Error("S3_OBJECT_UNREADABLE");
}

export async function uploadCsvToS3(key: string, csvContent: string): Promise<void> {
  ensureAwsConfigured();

  const payload = csvContent.trim();
  if (!payload) {
    throw new Error("CSV_CONTENT_EMPTY");
  }

  await getS3Client().send(new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: "text/csv",
    Body: payload,
  }));
}

export async function listS3KeysByPrefix(prefix: string): Promise<string[]> {
  ensureAwsConfigured();

  const collected: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await getS3Client().send(new ListObjectsV2Command({
      Bucket: env.AWS_S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    for (const item of response.Contents ?? []) {
      if (item.Key) {
        collected.push(item.Key);
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return collected;
}

export async function uploadRemoteLogoToS3(
  fullSymbol: string,
  sourceLogoUrl: string,
): Promise<{ s3Key: string; cdnUrl: string; variants: Record<string, string> } | null> {
  if (!hasAwsConfig) return null;

  const cachedKey = clusterScopedKey("logo:s3", fullSymbol.toUpperCase());
  if (isRedisReady()) {
    try {
      const cached = await redisClient.get(cachedKey);
      if (cached) {
        const payload = parseLogoCachePayload(cached);
        const variantUrls = buildVariantCdnUrls(payload.variants);
        return {
          s3Key: payload.defaultKey,
          cdnUrl: resolveCdnUrl(payload.defaultKey),
          variants: variantUrls,
        };
      }
    } catch {
      // Continue without Redis cache.
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(sourceLogoUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-worker/1.0" },
    });

    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    if (!body.length) return null;

    const versionHash = hashLogoVersion(body);
    const variantKeys = Object.fromEntries(
      LOGO_VARIANT_SIZES.map((size) => [String(size), buildLogoVariantKey(fullSymbol, size, versionHash)]),
    );
    const defaultKey = variantKeys[String(DEFAULT_LOGO_SIZE)] as string;

    try {
      await getS3Client().send(new HeadObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: defaultKey,
      }));

      const payload: LogoCachePayload = {
        defaultKey,
        variants: variantKeys,
      };

      if (isRedisReady()) {
        try {
          await redisClient.set(cachedKey, JSON.stringify(payload), "EX", 24 * 60 * 60);
        } catch {
          // Continue without Redis cache write.
        }
      }

      return {
        s3Key: defaultKey,
        cdnUrl: resolveCdnUrl(defaultKey),
        variants: buildVariantCdnUrls(variantKeys),
      };
    } catch {
      // Continue to upload when object is absent.
    }

    const variantBuffers = await optimizeLogoVariants(body);

    await Promise.all(
      Object.entries(variantBuffers).map(([size, buffer]) => getS3Client().send(new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: variantKeys[size] as string,
        Body: buffer,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000, immutable",
      }))),
    );

    const payload: LogoCachePayload = {
      defaultKey,
      variants: variantKeys,
    };

    if (isRedisReady()) {
      try {
        await redisClient.set(cachedKey, JSON.stringify(payload), "EX", 24 * 60 * 60);
      } catch {
        // Continue without Redis cache write.
      }
    }

    return {
      s3Key: defaultKey,
      cdnUrl: resolveCdnUrl(defaultKey),
      variants: buildVariantCdnUrls(variantKeys),
    };
  } finally {
    clearTimeout(timeout);
  }
}
