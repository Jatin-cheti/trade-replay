import axios from "axios";
import {
  type AssetSnapshotCandlesResponse,
  type AssetSnapshotIngestInput,
  type AssetSnapshotIngestResponse,
  type AssetSnapshotQuotesResponse,
  type AssetSnapshotRequest,
  type AssetSnapshotResponse,
} from "../contracts/assetSnapshot";
import { env } from "../config/env";
import { AppError } from "../utils/appError";

const assetServiceHttp = axios.create({
  baseURL: env.ASSET_SERVICE_URL,
  timeout: 4000,
  headers: {
    "x-internal-service-token": env.ASSET_SERVICE_INTERNAL_TOKEN,
  },
});

function normalizeClientSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));
}

function toServiceError(error: unknown, fallbackCode: string, fallbackMessage: string): never {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status ?? 503;
    const serviceMessage = typeof error.response?.data?.message === "string"
      ? error.response.data.message
      : fallbackMessage;
    throw new AppError(statusCode, fallbackCode, serviceMessage);
  }

  throw new AppError(503, fallbackCode, fallbackMessage);
}

export async function getSnapshots(input: AssetSnapshotRequest): Promise<AssetSnapshotResponse> {
  try {
    const response = await assetServiceHttp.post<AssetSnapshotResponse>("/asset-service/internal/snapshot", {
      symbols: normalizeClientSymbols(input.symbols),
      candleSymbols: normalizeClientSymbols(input.candleSymbols ?? []),
      candleLimit: input.candleLimit ?? 240,
    });
    return response.data;
  } catch (error) {
    toServiceError(error, "ASSET_SERVICE_SNAPSHOT_FAILED", "Asset service snapshot unavailable");
  }
}

export async function getAssetServiceQuotes(symbols: string[]): Promise<AssetSnapshotQuotesResponse> {
  try {
    const response = await assetServiceHttp.post<AssetSnapshotQuotesResponse>("/asset-service/internal/quotes", {
      symbols: normalizeClientSymbols(symbols),
    });
    return response.data;
  } catch (error) {
    toServiceError(error, "ASSET_SERVICE_QUOTES_FAILED", "Asset service quotes unavailable");
  }
}

export async function getAssetServiceCandles(input: { symbol: string; limit?: number }): Promise<AssetSnapshotCandlesResponse> {
  try {
    const response = await assetServiceHttp.post<AssetSnapshotCandlesResponse>("/asset-service/internal/candles", {
      symbol: input.symbol.trim().toUpperCase(),
      limit: input.limit ?? 240,
    });
    return response.data;
  } catch (error) {
    toServiceError(error, "ASSET_SERVICE_CANDLES_FAILED", "Asset service candles unavailable");
  }
}

export async function ingestAssetServiceSnapshots(input: AssetSnapshotIngestInput): Promise<AssetSnapshotIngestResponse> {
  try {
    const response = await assetServiceHttp.post<AssetSnapshotIngestResponse>("/asset-service/internal/snapshot/ingest", input);
    return response.data;
  } catch (error) {
    toServiceError(error, "ASSET_SERVICE_INGEST_FAILED", "Asset service snapshot ingest unavailable");
  }
}
