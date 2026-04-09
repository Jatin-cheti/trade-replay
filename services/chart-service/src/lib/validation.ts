import { z } from "zod";

export const candleSchema = z.object({
  time: z.coerce.number(),
  open: z.coerce.number(),
  high: z.coerce.number(),
  low: z.coerce.number(),
  close: z.coerce.number(),
  volume: z.coerce.number().optional(),
});

export const sourceSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  authToken: z.string().optional(),
});

export const indicatorSchema = z.object({
  id: z.string().min(1),
  params: z.record(z.number()).optional(),
});

export const computeIndicatorsSchema = z.object({
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

export const transformSchema = z.object({
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

export const bundleSchema = z.object({
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
