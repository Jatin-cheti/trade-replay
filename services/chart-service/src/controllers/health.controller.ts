import type { Request, Response } from "express";

export function getHealth(_req: Request, res: Response): void {
  res.json({
    ok: true,
    status: "ok",
    service: "chart-service",
    uptimeSeconds: Math.floor(process.uptime()),
    now: Date.now(),
  });
}
