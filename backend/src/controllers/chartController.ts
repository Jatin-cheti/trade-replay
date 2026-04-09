import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../utils/appError";
import { computeBundle, computeIndicators, transformCandles } from "../services/chartCompute.service";

const candleSchema = z.object({
  time: z.coerce.number(),
  open: z.coerce.number(),
  high: z.coerce.number(),
  low: z.coerce.number(),
  close: z.coerce.number(),
  volume: z.coerce.number().optional(),
});

const sourceSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  authToken: z.string().optional(),
});

const indicatorSchema = z.object({
  id: z.string().min(1),
  params: z.record(z.number()).optional(),
});

const computeIndicatorsSchema = z.object({
  candles: z.array(candleSchema).optional(),
  source: sourceSchema.optional(),
  indicators: z.array(indicatorSchema).min(1),
}).superRefine((value, ctx) => {
  if ((!value.candles || value.candles.length === 0) && !value.source) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["candles"],
      message: "Provide candles or source.",
    });
  }
});

const transformSchema = z.object({
  candles: z.array(candleSchema).optional(),
  source: sourceSchema.optional(),
  transformType: z.enum(["renko", "rangeBars", "lineBreak", "kagi", "pointFigure", "brick"]),
  params: z.record(z.number()).optional(),
}).superRefine((value, ctx) => {
  if ((!value.candles || value.candles.length === 0) && !value.source) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["candles"],
      message: "Provide candles or source.",
    });
  }
});

const bundleSchema = z.object({
  candles: z.array(candleSchema).optional(),
  source: sourceSchema.optional(),
  transformType: z.enum(["renko", "rangeBars", "lineBreak", "kagi", "pointFigure", "brick"]).optional(),
  params: z.record(z.number()).optional(),
  indicators: z.array(indicatorSchema).optional(),
}).superRefine((value, ctx) => {
  if ((!value.candles || value.candles.length === 0) && !value.source) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["candles"],
      message: "Provide candles or source.",
    });
  }
});

export function createChartController() {
  return {
    computeIndicators: async (req: Request, res: Response, next: NextFunction) => {
      const parsed = computeIndicatorsSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_CHART_INDICATOR_PAYLOAD", "Invalid chart indicator payload"));
        return;
      }

      try {
        const payload = await computeIndicators(parsed.data);
        res.json(payload);
      } catch (error) {
        next(error);
      }
    },

    transform: async (req: Request, res: Response, next: NextFunction) => {
      const parsed = transformSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_CHART_TRANSFORM_PAYLOAD", "Invalid chart transform payload"));
        return;
      }

      try {
        const payload = await transformCandles(parsed.data);
        res.json(payload);
      } catch (error) {
        next(error);
      }
    },

    bundle: async (req: Request, res: Response, next: NextFunction) => {
      const parsed = bundleSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_CHART_BUNDLE_PAYLOAD", "Invalid chart bundle payload"));
        return;
      }

      try {
        const payload = await computeBundle(parsed.data);
        res.json(payload);
      } catch (error) {
        next(error);
      }
    },
  };
}
