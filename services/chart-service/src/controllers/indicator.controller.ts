import type { Request, Response } from "express";
import { indicatorComputeSchema } from "../lib/validation";
import { computeIndicators, getIndicatorPresets } from "../services/indicator.service";

export async function computeIndicatorsController(req: Request, res: Response): Promise<void> {
  const parsed = indicatorComputeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: "INVALID_INDICATOR_REQUEST", message: parsed.error.message } });
    return;
  }

  const result = await computeIndicators(parsed.data.candles, parsed.data.graph);
  res.json({ ok: true, data: result });
}

export function getPresetsController(_req: Request, res: Response): void {
  res.json({ ok: true, data: getIndicatorPresets() });
}
