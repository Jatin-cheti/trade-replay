import crypto from "node:crypto";
import sharp from "sharp";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env, hasAwsConfig } from "../config/env";

const LOGO_PREFIX = "trade-replay/logos";
const VARIANT_SIZES = [32, 64, 128] as const;
const DEFAULT_SIZE = 64;

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;

  if (!hasAwsConfig) {
    throw new Error("MISSING_AWS_CONFIG");
  }

  client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

function cdnUrl(key: string): string {
  const base = env.AWS_CDN_BASE_URL.trim();
  if (base) {
    return `${base.replace(/\/$/, "")}/${key}`;
  }

  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}

function versionHash(buffer: Buffer): string {
  return crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 12);
}

function variantKey(fullSymbol: string, size: number, hash: string): string {
  const safe = fullSymbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "-");
  return `${LOGO_PREFIX}/${safe}_v${hash}_${size}.png`;
}

async function optimizeVariants(image: Buffer): Promise<Record<string, Buffer>> {
  const entries = await Promise.all(
    VARIANT_SIZES.map(async (size) => {
      const resized = await sharp(image)
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

      return [String(size), resized] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function uploadRemoteLogoToS3(
  fullSymbol: string,
  sourceLogoUrl: string,
): Promise<{ s3Key: string; cdnUrl: string } | null> {
  if (!hasAwsConfig) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(sourceLogoUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "tradereplay-logo-service/1.0" },
    });

    if (!response.ok) return null;
    const image = Buffer.from(await response.arrayBuffer());
    if (!image.length) return null;

    const hash = versionHash(image);
    const keys = Object.fromEntries(
      VARIANT_SIZES.map((size) => [String(size), variantKey(fullSymbol, size, hash)]),
    );
    const defaultKey = keys[String(DEFAULT_SIZE)] as string;

    try {
      await getClient().send(new HeadObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: defaultKey,
      }));

      return { s3Key: defaultKey, cdnUrl: cdnUrl(defaultKey) };
    } catch {
      // Not present, continue to upload.
    }

    const variants = await optimizeVariants(image);
    await Promise.all(
      Object.entries(variants).map(([size, body]) => getClient().send(new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: keys[size] as string,
        Body: body,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000, immutable",
      }))),
    );

    return { s3Key: defaultKey, cdnUrl: cdnUrl(defaultKey) };
  } finally {
    clearTimeout(timeout);
  }
}
