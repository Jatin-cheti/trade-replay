import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";

const PORTFOLIO_PREFIX = "trade-replay/portfolios";
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

export function buildPortfolioUploadKey(userId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `${PORTFOLIO_PREFIX}/${userId}/${Date.now()}-${safeName}`;
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
): Promise<{ uploadUrl: string; s3Key: string }> {
  ensureCsvUploadRequest(fileName, contentType, fileSizeBytes);
  const key = buildPortfolioUploadKey(userId, fileName);
  const resolvedContentType = (contentType?.trim().toLowerCase() || "text/csv");

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
  const expectedPrefix = `${PORTFOLIO_PREFIX}/${userId}/`;
  if (!normalizedKey.startsWith(expectedPrefix)) {
    throw new Error("INVALID_S3_KEY_SCOPE");
  }
  if (!normalizedKey.toLowerCase().endsWith(".csv")) {
    throw new Error("INVALID_S3_KEY_SCOPE");
  }
}

export async function downloadPortfolioCsv(userId: string, key: string): Promise<string> {
  assertKeyOwnership(userId, key);

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
