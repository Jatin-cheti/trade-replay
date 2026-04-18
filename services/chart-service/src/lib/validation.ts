import { z } from "zod";

const timeframeSchema = z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1M"]);
const nodeTypeSchema = z.enum([
  "SOURCE",
  "SMA", "EMA", "WMA", "DEMA", "TEMA",
  "RSI", "MACD", "BOLLINGER", "ATR", "VWAP",
  "STOCHASTIC", "OBV", "ADX", "CCI", "WILLIAMS_R",
  "MFI", "CMF", "AROON", "STDDEV", "SUPERTREND",
  "ADD", "SUBTRACT", "MULTIPLY", "DIVIDE",
  "GT", "LT", "GTE", "LTE", "EQ",
  "CROSS_ABOVE", "CROSS_BELOW",
  "IF", "AND", "OR", "NOT",
  "PLOT", "FILL", "LABEL",
]);

export const candleQuerySchema = z.object({
  symbol: z.string().min(1),
  timeframe: timeframeSchema,
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
});

export const multiCandleQuerySchema = z.object({
  symbols: z.array(z.string().min(1)).min(1).max(25),
  timeframe: timeframeSchema,
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().positive().max(2000).optional(),
});

export const indicatorNodeSchema = z.object({
  id: z.string().min(1),
  type: nodeTypeSchema,
  inputs: z.record(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

export const indicatorGraphSchema = z.object({
  indicatorId: z.string().min(1),
  version: z.coerce.number().int().positive(),
  nodes: z.array(indicatorNodeSchema).min(1),
  outputs: z.array(z.string().min(1)).min(1),
});

export const indicatorComputeSchema = z.object({
  candles: z.array(
    z.object({
      timestamp: z.coerce.number().int(),
      open: z.coerce.number(),
      high: z.coerce.number(),
      low: z.coerce.number(),
      close: z.coerce.number(),
      volume: z.coerce.number(),
    }),
  ).min(1),
  graph: indicatorGraphSchema,
});

const legacyCandleSchema = z.object({
  time: z.coerce.number(),
  open: z.coerce.number(),
  high: z.coerce.number(),
  low: z.coerce.number(),
  close: z.coerce.number(),
  volume: z.coerce.number().optional(),
});

const legacySourceSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().optional(),
  from: z.union([z.string(), z.number()]).optional(),
  to: z.union([z.string(), z.number()]).optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
  dataMode: z.enum(["default", "parity-live"]).optional(),
  authToken: z.string().optional(),
});

const legacyIndicatorSchema = z.object({
  id: z.string().min(1),
  params: z.record(z.coerce.number()).optional(),
});

const legacyTransformTypeSchema = z.enum(["renko", "rangeBars", "lineBreak", "kagi", "pointFigure", "brick"]);

function requireCandlesOrSource(
  value: { candles?: unknown[]; source?: unknown },
  ctx: z.RefinementCtx,
): void {
  if ((!value.candles || value.candles.length === 0) && !value.source) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["candles"],
      message: "Provide candles or source.",
    });
  }
}

export const legacyComputeIndicatorsSchema = z.object({
  candles: z.array(legacyCandleSchema).optional(),
  source: legacySourceSchema.optional(),
  indicators: z.array(legacyIndicatorSchema).min(1),
}).superRefine((value, ctx) => requireCandlesOrSource(value, ctx));

export const legacyTransformSchema = z.object({
  candles: z.array(legacyCandleSchema).optional(),
  source: legacySourceSchema.optional(),
  transformType: legacyTransformTypeSchema,
  params: z.record(z.coerce.number()).optional(),
}).superRefine((value, ctx) => requireCandlesOrSource(value, ctx));

export const legacyBundleSchema = z.object({
  candles: z.array(legacyCandleSchema).optional(),
  source: legacySourceSchema.optional(),
  transformType: legacyTransformTypeSchema.optional(),
  params: z.record(z.coerce.number()).optional(),
  indicators: z.array(legacyIndicatorSchema).optional(),
}).superRefine((value, ctx) => requireCandlesOrSource(value, ctx));
