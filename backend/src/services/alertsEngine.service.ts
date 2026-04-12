/**
 * Production Alerts Engine
 * Consumes market.tick from Kafka, evaluates alerts in-memory,
 * deduplicates via Redis SETNX, enforces cooldowns, produces
 * alert.fired events to Kafka, and pushes to Socket.IO.
 *
 * Architecture:
 *   Kafka      - market.tick consumer + alert.fired producer
 *   MongoDB    - persistent alert definitions
 *   Redis      - alerts:{symbol} cache, last_price:{symbol}, dedup locks, cooldown
 *   Memory     - Map<symbol, Alert[]> for O(k) per-tick
 *   Socket.IO  - push to connected user
 */

import { Server } from "socket.io";
import { redisClient, isRedisReady } from "../config/redis";
import { AlertModel } from "../models/Alert";
import { logger } from "../utils/logger";

// --- types ---

export type AlertConditionType =
  | "price_above"
  | "price_below"
  | "price_cross_above"
  | "price_cross_below"
  | "percent_change_above"
  | "percent_change_below";

export interface AlertDefinition {
  id: string;
  userId: string;
  symbol: string;
  condition: AlertConditionType;
  threshold: number;
  message?: string;
  cooldownSec: number;
  fireOnce: boolean;
  active: boolean;
  lastTriggeredAt: number;
  createdAt: Date;
}

export interface AlertFiredEvent {
  alertId: string;
  userId: string;
  symbol: string;
  condition: AlertConditionType;
  threshold: number;
  triggeredPrice: number;
  message: string;
  timestamp: number;
}

export interface MarketTickPayload {
  symbol: string;
  price: number;
  timestamp: number;
}

// --- constants ---

const REDIS_ALERTS_PREFIX = "alerts:";
const REDIS_LAST_PRICE_PREFIX = "last_price:";
const REDIS_DEDUP_PREFIX = "alert:lock:";
const DEDUP_TTL_SEC = 60;
const SYNC_INTERVAL_MS = 30_000;
const BATCH_SIZE = 200;
const BATCH_YIELD_MS = 2;
const REDIS_ALERT_TTL_SEC = 120;

// --- state ---

const alertsBySymbol = new Map<string, AlertDefinition[]>();
let syncTimer: ReturnType<typeof setInterval> | null = null;
let ioRef: Server | null = null;
// --- Redis helpers ---

function alertsRedisKey(symbol: string): string {
  return REDIS_ALERTS_PREFIX + symbol.toUpperCase();
}

function lastPriceRedisKey(symbol: string): string {
  return REDIS_LAST_PRICE_PREFIX + symbol.toUpperCase();
}

function dedupRedisKey(alertId: string): string {
  return REDIS_DEDUP_PREFIX + alertId;
}

// --- bootstrap (DB -> Redis -> Memory) ---

export async function bootstrapAlerts(io?: Server): Promise<number> {
  if (io) ioRef = io;

  const docs = await AlertModel.find({ active: true })
    .select({
      _id: 1, userId: 1, symbol: 1, condition: 1, threshold: 1,
      message: 1, cooldownSec: 1, fireOnce: 1, active: 1,
      lastTriggeredAt: 1, createdAt: 1,
    })
    .lean<Array<{
      _id: { toString(): string };
      userId: string;
      symbol: string;
      condition: AlertConditionType;
      threshold: number;
      message?: string;
      cooldownSec?: number;
      fireOnce?: boolean;
      active: boolean;
      lastTriggeredAt?: Date | number;
      createdAt: Date;
    }>>();

  alertsBySymbol.clear();

  const bySymbol = new Map<string, AlertDefinition[]>();
  for (const doc of docs) {
    const alert = docToAlert(doc);
    const list = bySymbol.get(alert.symbol) ?? [];
    list.push(alert);
    bySymbol.set(alert.symbol, list);
  }

  // write to Redis + memory
  if (isRedisReady()) {
    const pipeline = redisClient.pipeline();
    for (const [symbol, list] of bySymbol) {
      pipeline.set(alertsRedisKey(symbol), JSON.stringify(list), "EX", REDIS_ALERT_TTL_SEC);
    }
    await pipeline.exec();
  }

  for (const [symbol, list] of bySymbol) {
    alertsBySymbol.set(symbol, list);
  }

  logger.info("alerts_bootstrap_complete", { total: docs.length, symbols: bySymbol.size });
  startSyncTimer();
  return docs.length;
}

function docToAlert(doc: {
  _id: { toString(): string };
  userId: string;
  symbol: string;
  condition: AlertConditionType;
  threshold: number;
  message?: string;
  cooldownSec?: number;
  fireOnce?: boolean;
  active: boolean;
  lastTriggeredAt?: Date | number;
  createdAt: Date;
}): AlertDefinition {
  let lastTrig = 0;
  if (doc.lastTriggeredAt instanceof Date) lastTrig = doc.lastTriggeredAt.getTime();
  else if (typeof doc.lastTriggeredAt === "number") lastTrig = doc.lastTriggeredAt;
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    symbol: doc.symbol.toUpperCase(),
    condition: doc.condition,
    threshold: doc.threshold,
    message: doc.message,
    cooldownSec: doc.cooldownSec ?? 300,
    fireOnce: doc.fireOnce ?? false,
    active: true,
    lastTriggeredAt: lastTrig,
    createdAt: doc.createdAt,
  };
}
// --- periodic sync (DB -> Redis -> Memory) ---

function startSyncTimer(): void {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    void syncAlertsFromDB().catch((err) => {
      logger.error("alerts_sync_failed", { error: err instanceof Error ? err.message : String(err) });
    });
  }, SYNC_INTERVAL_MS);
  syncTimer.unref();
}

async function syncAlertsFromDB(): Promise<void> {
  const docs = await AlertModel.find({ active: true })
    .select({
      _id: 1, userId: 1, symbol: 1, condition: 1, threshold: 1,
      message: 1, cooldownSec: 1, fireOnce: 1, active: 1,
      lastTriggeredAt: 1, createdAt: 1,
    })
    .lean<Array<{
      _id: { toString(): string };
      userId: string;
      symbol: string;
      condition: AlertConditionType;
      threshold: number;
      message?: string;
      cooldownSec?: number;
      fireOnce?: boolean;
      active: boolean;
      lastTriggeredAt?: Date | number;
      createdAt: Date;
    }>>();

  const bySymbol = new Map<string, AlertDefinition[]>();
  for (const doc of docs) {
    const alert = docToAlert(doc);
    const list = bySymbol.get(alert.symbol) ?? [];
    list.push(alert);
    bySymbol.set(alert.symbol, list);
  }

  if (isRedisReady()) {
    for (const symbol of alertsBySymbol.keys()) {
      if (!bySymbol.has(symbol)) {
        await redisClient.del(alertsRedisKey(symbol));
      }
    }
    const pipeline = redisClient.pipeline();
    for (const [symbol, list] of bySymbol) {
      pipeline.set(alertsRedisKey(symbol), JSON.stringify(list), "EX", REDIS_ALERT_TTL_SEC);
    }
    await pipeline.exec();
  }

  alertsBySymbol.clear();
  for (const [symbol, list] of bySymbol) {
    alertsBySymbol.set(symbol, list);
  }

  logger.info("alerts_sync_complete", { total: docs.length, symbols: bySymbol.size });
}

export function stopSyncTimer(): void {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

// --- runtime registration (from controller) ---

export function registerAlert(alert: AlertDefinition): void {
  const list = alertsBySymbol.get(alert.symbol) ?? [];
  const idx = list.findIndex((a) => a.id === alert.id);
  if (idx >= 0) list[idx] = alert;
  else list.push(alert);
  alertsBySymbol.set(alert.symbol, list);

  if (isRedisReady()) {
    void redisClient.set(
      alertsRedisKey(alert.symbol),
      JSON.stringify(alertsBySymbol.get(alert.symbol)),
      "EX", REDIS_ALERT_TTL_SEC,
    ).catch(() => {});
  }
}

export function deactivateAlert(alertId: string): void {
  for (const [symbol, list] of alertsBySymbol.entries()) {
    const idx = list.findIndex((a) => a.id === alertId);
    if (idx >= 0) {
      list.splice(idx, 1);
      alertsBySymbol.set(symbol, list);
      if (isRedisReady()) {
        void redisClient.set(
          alertsRedisKey(symbol), JSON.stringify(list), "EX", REDIS_ALERT_TTL_SEC,
        ).catch(() => {});
      }
      break;
    }
  }
}

export function getAlertsForSymbol(symbol: string): AlertDefinition[] {
  return alertsBySymbol.get(symbol.toUpperCase()) ?? [];
}

export function getAlertCount(): { total: number; symbols: number } {
  let total = 0;
  for (const list of alertsBySymbol.values()) total += list.length;
  return { total, symbols: alertsBySymbol.size };
}
// --- last price (Redis-backed) ---

async function getLastPrice(symbol: string): Promise<number | undefined> {
  if (!isRedisReady()) return undefined;
  const val = await redisClient.get(lastPriceRedisKey(symbol));
  return val ? Number(val) : undefined;
}

async function setLastPrice(symbol: string, price: number): Promise<void> {
  if (!isRedisReady()) return;
  await redisClient.set(lastPriceRedisKey(symbol), String(price), "EX", 86400);
}

// --- deduplication (SETNX) ---

async function acquireDedup(alertId: string): Promise<boolean> {
  if (!isRedisReady()) return true;
  const result = await redisClient.set(dedupRedisKey(alertId), "1", "EX", DEDUP_TTL_SEC, "NX");
  return result === "OK";
}

// --- cooldown ---

function isCooledDown(alert: AlertDefinition, nowMs: number): boolean {
  if (alert.lastTriggeredAt === 0) return true;
  return (nowMs - alert.lastTriggeredAt) >= alert.cooldownSec * 1000;
}

// --- condition evaluation ---

function evaluateCondition(
  condition: AlertConditionType,
  threshold: number,
  currentPrice: number,
  prevPrice: number | undefined,
): boolean {
  switch (condition) {
    case "price_above":
      return currentPrice > threshold;
    case "price_below":
      return currentPrice < threshold;
    case "price_cross_above":
      return prevPrice !== undefined && prevPrice <= threshold && currentPrice > threshold;
    case "price_cross_below":
      return prevPrice !== undefined && prevPrice >= threshold && currentPrice < threshold;
    case "percent_change_above": {
      if (prevPrice == null || prevPrice === 0) return false;
      return ((currentPrice - prevPrice) / prevPrice) * 100 >= threshold;
    }
    case "percent_change_below": {
      if (prevPrice == null || prevPrice === 0) return false;
      return ((currentPrice - prevPrice) / prevPrice) * 100 <= -Math.abs(threshold);
    }
    default:
      return false;
  }
}

// --- microtask yield ---

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, BATCH_YIELD_MS));
}
// --- core evaluation (called per market tick from Kafka) ---

/**
 * Evaluate all alerts for a single symbol tick.
 * Called from Kafka market.tick consumer - NOT from simulationEngine.
 */
export async function evaluateAlertsForTick(
  symbol: string,
  currentPrice: number,
  timestamp: number,
): Promise<AlertFiredEvent[]> {
  const upper = symbol.toUpperCase();
  const alerts = alertsBySymbol.get(upper);
  if (!alerts || alerts.length === 0) {
    void setLastPrice(upper, currentPrice);
    return [];
  }

  const prevPrice = await getLastPrice(upper);
  void setLastPrice(upper, currentPrice);

  const nowMs = timestamp || Date.now();
  const fired: AlertFiredEvent[] = [];
  const toDeactivate: string[] = [];
  let processed = 0;

  for (const alert of alerts) {
    if (!alert.active) continue;

    // cooldown check (in-memory)
    if (!isCooledDown(alert, nowMs)) continue;

    // condition check
    const triggered = evaluateCondition(alert.condition, alert.threshold, currentPrice, prevPrice);
    if (!triggered) continue;

    // deduplication (Redis SETNX)
    const dedupOk = await acquireDedup(alert.id);
    if (!dedupOk) continue;

    // fire
    alert.lastTriggeredAt = nowMs;

    const event: AlertFiredEvent = {
      alertId: alert.id,
      userId: alert.userId,
      symbol: upper,
      condition: alert.condition,
      threshold: alert.threshold,
      triggeredPrice: currentPrice,
      message: alert.message || `${upper} ${alert.condition.replace(/_/g, " ")} ${alert.threshold}`,
      timestamp: nowMs,
    };

    fired.push(event);

    // Socket.IO push
    if (ioRef) {
      ioRef.to(alert.userId).emit("alert:fired", event);
    }

    // fire-once -> deactivate
    if (alert.fireOnce) {
      toDeactivate.push(alert.id);
    }

    logger.info("alert_fired", {
      alertId: alert.id,
      userId: alert.userId,
      symbol: upper,
      condition: alert.condition,
      threshold: alert.threshold,
      triggeredPrice: currentPrice,
    });

    // batch yield for event loop safety
    processed++;
    if (processed % BATCH_SIZE === 0) {
      await yieldToEventLoop();
    }
  }

  // deactivate fire-once alerts
  if (toDeactivate.length > 0) {
    for (const id of toDeactivate) {
      deactivateAlert(id);
      void AlertModel.updateOne({ _id: id }, { $set: { active: false, lastTriggeredAt: new Date(nowMs) } }).catch(() => {});
    }
  }

  // persist lastTriggeredAt for non-fireOnce alerts that fired
  for (const event of fired) {
    if (!toDeactivate.includes(event.alertId)) {
      void AlertModel.updateOne(
        { _id: event.alertId },
        { $set: { lastTriggeredAt: new Date(event.timestamp) } },
      ).catch(() => {});
    }
  }

  return fired;
}

// --- bulk evaluation with batching (event loop safety for >1000 alerts) ---

export async function evaluateTickBatch(
  ticks: MarketTickPayload[],
): Promise<AlertFiredEvent[]> {
  const allFired: AlertFiredEvent[] = [];
  let symbolsProcessed = 0;
  const totalAlerts = getAlertCount().total;
  const shouldYield = totalAlerts > 1000;

  for (const tick of ticks) {
    const events = await evaluateAlertsForTick(tick.symbol, tick.price, tick.timestamp);
    allFired.push(...events);
    symbolsProcessed++;

    if (shouldYield && symbolsProcessed % 10 === 0) {
      await yieldToEventLoop();
    }
  }

  return allFired;
}