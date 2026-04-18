import type { Request, Response } from "express";
import {
  legacyBundleSchema,
  legacyComputeIndicatorsSchema,
  legacyTransformSchema,
} from "../lib/validation";
import {
  computeBundleLegacy,
  computeIndicatorsLegacy,
  transformCandlesLegacy,
} from "../services/legacy-chart.service";

export async function computeIndicatorsLegacyController(req: Request, res: Response): Promise<void> {
  const parsed = legacyComputeIndicatorsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: "INVALID_CHART_INDICATOR_PAYLOAD", message: parsed.error.message } });
    return;
  }

  const result = await computeIndicatorsLegacy(parsed.data);
  res.json(result);
}

export async function transformLegacyController(req: Request, res: Response): Promise<void> {
  const parsed = legacyTransformSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: "INVALID_CHART_TRANSFORM_PAYLOAD", message: parsed.error.message } });
    return;
  }

  const result = await transformCandlesLegacy(parsed.data);
  res.json(result);
}

export async function bundleLegacyController(req: Request, res: Response): Promise<void> {
  const parsed = legacyBundleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: "INVALID_CHART_BUNDLE_PAYLOAD", message: parsed.error.message } });
    return;
  }

  const result = await computeBundleLegacy(parsed.data);
  res.json(result);
}
