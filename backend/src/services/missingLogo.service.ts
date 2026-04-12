import type { PipelineStage } from "mongoose";
import { MissingLogoModel } from "../models/MissingLogo";
import { SymbolModel } from "../models/Symbol";
import { nextRetryAt, shouldMarkUnresolvable, shouldSkipForNow } from "./retryManager.service";

const MAX_RETRY_COUNT = 6;

export interface MissingLogoWorkItem {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  count: number;
  searchFrequency: number;
  userUsage: number;
  retryCount: number;
  status: "pending" | "resolved" | "failed" | "unresolved" | "unresolvable";
  popularity?: number;
  nextRetryAt?: Date;
  lastAttemptFailedAt?: Date;
}

export function isFallbackIcon(iconUrl?: string | null): boolean {
  const normalized = (iconUrl ?? "").toLowerCase();
  if (!normalized) return true;

  return normalized.includes("exchange")
    || normalized.includes("default")
    || normalized.includes("generated")
    || normalized.includes("/icons/exchange/")
    || normalized.includes("/icons/category/")
    || normalized.includes("/icons/sector/");
}

export async function upsertMissingLogoFromSymbol(input: {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: string;
  country: string;
}): Promise<void> {
  const now = new Date();
  await MissingLogoModel.updateOne(
    { fullSymbol: input.fullSymbol.toUpperCase() },
    {
      $setOnInsert: {
        symbol: input.symbol.toUpperCase(),
        fullSymbol: input.fullSymbol.toUpperCase(),
        name: input.name,
        exchange: input.exchange.toUpperCase(),
        type: input.type.toLowerCase(),
        country: input.country.toUpperCase(),
        fallbackType: "detected",
        status: "pending",
        nextRetryAt: null,
        retryCount: 0,
        lastAttemptFailedAt: null,
        lastAttemptAt: null,
        lastError: "",
        firstSeenAt: now,
      },
      $set: {
        lastSeenAt: now,
      },
      $inc: {
        count: 1,
        searchFrequency: 1,
        userUsage: 1,
      },
    },
    { upsert: true },
  );
}

export async function repopulateMissingLogos(): Promise<{ scanned: number; queued: number }> {
  const cursor = SymbolModel.find({}).select({
    symbol: 1,
    fullSymbol: 1,
    name: 1,
    exchange: 1,
    type: 1,
    country: 1,
    iconUrl: 1,
  }).lean().cursor();

  let scanned = 0;
  let queued = 0;
  const bulkOps: Array<{
    updateOne: {
      filter: { fullSymbol: string };
      update: Record<string, unknown>;
      upsert: true;
    };
  }> = [];

  async function flushBulkOps(): Promise<void> {
    if (!bulkOps.length) return;
    await MissingLogoModel.bulkWrite(bulkOps, { ordered: false });
    bulkOps.length = 0;
  }

  for await (const symbol of cursor as AsyncIterable<{
    symbol: string;
    fullSymbol: string;
    name: string;
    exchange: string;
    type: string;
    country: string;
    iconUrl?: string;
  }>) {
    scanned += 1;

    if (!isFallbackIcon(symbol.iconUrl)) {
      continue;
    }

    const now = new Date();
    bulkOps.push({
      updateOne: {
        filter: { fullSymbol: symbol.fullSymbol.toUpperCase() },
        update: {
          $setOnInsert: {
            symbol: symbol.symbol.toUpperCase(),
            fullSymbol: symbol.fullSymbol.toUpperCase(),
            name: symbol.name,
            exchange: symbol.exchange.toUpperCase(),
            type: symbol.type.toLowerCase(),
            country: symbol.country.toUpperCase(),
            fallbackType: "detected",
            status: "pending",
            nextRetryAt: null,
            retryCount: 0,
            lastAttemptFailedAt: null,
            lastAttemptAt: null,
            lastError: "",
            firstSeenAt: now,
          },
          $set: {
            lastSeenAt: now,
          },
          $inc: {
            count: 1,
            searchFrequency: 1,
            userUsage: 1,
          },
        },
        upsert: true,
      },
    });

    if (bulkOps.length >= 500) {
      // eslint-disable-next-line no-await-in-loop
      await flushBulkOps();
    }

    queued += 1;
  }

  await flushBulkOps();

  return { scanned, queued };
}

export async function reopenFalseResolvedItems(): Promise<number> {
  const rows = await MissingLogoModel.aggregate<{ fullSymbol: string }>([
    { $match: { status: "resolved" } },
    {
      $lookup: {
        from: "symbols",
        localField: "fullSymbol",
        foreignField: "fullSymbol",
        as: "symbolDoc",
      },
    },
    {
      $addFields: {
        iconUrl: { $ifNull: [{ $arrayElemAt: ["$symbolDoc.iconUrl", 0] }, ""] },
      },
    },
    {
      $match: {
        $or: [
          { iconUrl: "" },
          { iconUrl: { $regex: "exchange|default|generated|/icons/exchange/|/icons/category/|/icons/sector/", $options: "i" } },
        ],
      },
    },
    { $project: { fullSymbol: 1 } },
  ]);

  if (!rows.length) return 0;

  const symbols = rows.map((row) => row.fullSymbol);
  const result = await MissingLogoModel.updateMany(
    { fullSymbol: { $in: symbols } },
    {
      $set: {
        status: "pending",
        resolvedAt: null,
      },
    },
  );

  return result.modifiedCount;
}

export async function getMissingLogosBatch(limit: number, options?: { includeUnresolved?: boolean }): Promise<MissingLogoWorkItem[]> {
  const now = new Date();
  const statuses = options?.includeUnresolved
    ? ["pending", "failed", "unresolved", "unresolvable"]
    : ["pending", "failed"];
  const pipeline: PipelineStage[] = [
    {
      $match: {
        status: { $in: statuses },
        retryCount: { $lt: MAX_RETRY_COUNT },
        $or: [
          { nextRetryAt: { $exists: false } },
          { nextRetryAt: null },
          { nextRetryAt: { $lte: now } },
        ],
      },
    },
    {
      $lookup: {
        from: "symbols",
        localField: "fullSymbol",
        foreignField: "fullSymbol",
        as: "symbolDoc",
      },
    },
    {
      $addFields: {
        searchFrequencyLookup: { $ifNull: [{ $arrayElemAt: ["$symbolDoc.searchFrequency", 0] }, 0] },
        userUsageLookup: { $ifNull: [{ $arrayElemAt: ["$symbolDoc.userUsage", 0] }, 0] },
      },
    },
    {
      $addFields: {
        indiaBoost: {
          $cond: [
            { $in: [{ $toUpper: "$country" }, ["IN", "INDIA"]] },
            100,
            0,
          ],
        },
        knownExchangeBoost: {
          $cond: [
            { $in: [{ $toUpper: "$exchange" }, ["NSE", "BSE", "NASDAQ", "NYSE"]] },
            80,
            0,
          ],
        },
        cleanTickerBoost: {
          $cond: [
            { $regexMatch: { input: "$symbol", regex: /^[A-Z0-9]{1,12}$/ } },
            120,
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        priorityScore: {
          $add: [
            { $multiply: ["$count", 5] },
            "$searchFrequency",
            { $multiply: ["$userUsage", 2] },
            "$searchFrequencyLookup",
            { $multiply: ["$userUsageLookup", 2] },
            "$indiaBoost",
            "$knownExchangeBoost",
            "$cleanTickerBoost",
          ],
        },
      },
    },
    { $sort: { priorityScore: -1 as const, lastSeenAt: -1 as const } },
    { $limit: limit },
    {
      $project: {
        symbol: 1,
        fullSymbol: 1,
        name: 1,
        exchange: 1,
        country: 1,
        type: 1,
        count: 1,
        searchFrequency: 1,
        userUsage: 1,
        retryCount: 1,
        status: 1,
        nextRetryAt: 1,
        lastAttemptFailedAt: 1,
      },
    },
  ];

  const rows = await MissingLogoModel.aggregate<MissingLogoWorkItem>(pipeline);
  return rows.filter((row) => !shouldSkipForNow({ retryCount: row.retryCount, lastAttemptFailedAt: row.lastAttemptFailedAt }));
}

export async function resetUnresolvedToPending(): Promise<number> {
  const result = await MissingLogoModel.updateMany(
    { status: { $in: ["unresolved", "unresolvable"] } },
    {
      $set: {
        status: "pending",
        nextRetryAt: null,
        retryCount: 0,
        lastAttemptFailedAt: null,
        lastAttemptAt: null,
        lastError: "",
      },
    },
  );

  return result.modifiedCount;
}

export async function markResolved(fullSymbol: string): Promise<void> {
  await MissingLogoModel.updateOne(
    { fullSymbol: fullSymbol.toUpperCase() },
    {
      $set: {
        status: "resolved",
        resolvedAt: new Date(),
        lastError: "",
        nextRetryAt: null,
      },
    },
  );
}

export async function markFailed(fullSymbol: string, reason: string, options?: { hasDomain?: boolean; hasLogo?: boolean }): Promise<void> {
  const now = new Date();
  const result = await MissingLogoModel.findOneAndUpdate(
    { fullSymbol: fullSymbol.toUpperCase() },
    {
      $inc: { retryCount: 1 },
      $set: {
        status: "failed",
        lastError: reason.slice(0, 300),
        lastAttemptAt: now,
        lastAttemptFailedAt: now,
      },
    },
    { new: true },
  ).lean<{ retryCount: number; lastAttemptFailedAt?: Date | string | null } | null>();

  if (!result) return;

  const hasDomain = options?.hasDomain ?? false;
  const hasLogo = options?.hasLogo ?? false;
  if (shouldMarkUnresolvable({ retryCount: result.retryCount ?? 0, hasDomain, hasLogo })) {
    await MissingLogoModel.updateOne(
      { fullSymbol: fullSymbol.toUpperCase() },
      {
        $set: {
          status: "unresolvable",
          nextRetryAt: nextRetryAt({ now }),
        },
      },
    );
    return;
  }

  if (shouldSkipForNow({ retryCount: result.retryCount ?? 0, lastAttemptFailedAt: result.lastAttemptFailedAt, now })) {
    await MissingLogoModel.updateOne(
      { fullSymbol: fullSymbol.toUpperCase() },
      {
        $set: {
          nextRetryAt: nextRetryAt({ now }),
        },
      },
    );
    return;
  }

  if ((result.retryCount ?? 0) >= MAX_RETRY_COUNT) {
    await MissingLogoModel.updateOne(
      { fullSymbol: fullSymbol.toUpperCase() },
      {
        $set: {
          status: "unresolved",
          nextRetryAt: nextRetryAt({ now }),
        },
      },
    );
  }
}

