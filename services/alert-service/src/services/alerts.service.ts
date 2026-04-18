import { AlertModel } from "../models/Alert.js";
import { getRedis } from "../config/redis.js";

type AlertCondition = "price_above" | "price_below" | "price_cross_above" | "price_cross_below" | "percent_change_above" | "percent_change_below";

interface InMemoryAlert {
  id: string; userId: string; symbol: string;
  condition: AlertCondition; threshold: number;
  message: string; cooldownSec: number; fireOnce: boolean;
  active: boolean; lastTriggeredAt: number;
}

const alerts = new Map<string, InMemoryAlert>();

export async function bootstrapAlerts(): Promise<void> {
  const docs = await AlertModel.find({ active: true }).lean();
  for (const d of docs) {
    const doc = d as Record<string, unknown>;
    alerts.set(String(doc._id), {
      id: String(doc._id), userId: String(doc.userId),
      symbol: String(doc.symbol), condition: doc.condition as AlertCondition,
      threshold: Number(doc.threshold), message: String(doc.message || ""),
      cooldownSec: Number(doc.cooldownSec || 300),
      fireOnce: Boolean(doc.fireOnce), active: true,
      lastTriggeredAt: doc.lastTriggeredAt ? new Date(doc.lastTriggeredAt as string).getTime() : 0,
    });
  }
  console.log(`[alert-service] Bootstrapped ${alerts.size} active alerts`);
}

export function registerAlert(alert: InMemoryAlert): void {
  alerts.set(alert.id, alert);
}

export function deactivateAlert(id: string): void {
  alerts.delete(id);
}

export function getAlertCount(): { active: number } {
  return { active: alerts.size };
}

export async function evaluateAlertsForTick(symbol: string, price: number): Promise<void> {
  const now = Date.now();
  const redis = getRedis();
  for (const [id, alert] of alerts) {
    if (alert.symbol !== symbol) continue;
    if (now - alert.lastTriggeredAt < alert.cooldownSec * 1000) continue;

    let triggered = false;
    if (alert.condition === "price_above" && price > alert.threshold) triggered = true;
    if (alert.condition === "price_below" && price < alert.threshold) triggered = true;

    if (triggered) {
      alert.lastTriggeredAt = now;
      if (alert.fireOnce) { alerts.delete(id); await AlertModel.updateOne({ _id: id }, { active: false }); }
      else await AlertModel.updateOne({ _id: id }, { lastTriggeredAt: new Date(now) });

      try {
        await redis.publish("alert:triggered", JSON.stringify({ alertId: id, userId: alert.userId, symbol, price, condition: alert.condition, threshold: alert.threshold, message: alert.message }));
      } catch {}
    }
  }
}
