const fs = require("fs");

const routesPath = "/opt/tradereplay/backend/src/routes/screenerRoutes.ts";
const controllerPath = "/opt/tradereplay/backend/src/controllers/screenerController.ts";

function patchRoutes() {
  let src = fs.readFileSync(routesPath, "utf8");

  if (!src.includes("chartData")) {
    src = src.replace(
      'import { fastSearch, filterOptions, list, meta, stats, symbolDetail } from "../controllers/screenerController";',
      'import { fastSearch, filterOptions, list, meta, stats, symbolDetail, chartData } from "../controllers/screenerController";'
    );
  }

  if (!src.includes('router.get("/chart-data", chartData);')) {
    src = src.replace(
      '  router.get("/symbol/:symbol", symbolDetail);',
      '  router.get("/chart-data", chartData);\n  router.get("/symbol/:symbol", symbolDetail);'
    );
  }

  fs.writeFileSync(routesPath, src, "utf8");
}

function patchController() {
  let src = fs.readFileSync(controllerPath, "utf8");

  if (!src.includes('import { CONFIG } from "../config";')) {
    src = src.replace(
      'import { logger } from "../utils/logger";',
      'import { logger } from "../utils/logger";\nimport { CONFIG } from "../config";'
    );
  }

  if (!src.includes("interface OHLCVCandle")) {
    const anchor = 'import type { ScreenerFiltersInput } from "../services/screener/screener.types";';
    const block = [
      anchor,
      "",
      "/* Chart-service integration for screener chart data */",
      "",
      "interface OHLCVCandle {",
      "  timestamp: number;",
      "  open: number;",
      "  high: number;",
      "  low: number;",
      "  close: number;",
      "  volume: number;",
      "}",
      "",
      "const PERIOD_CHART_MAP: Record<string, { timeframe: string; limit: number }> = {",
      '  "1D":  { timeframe: "5m",  limit: 78  },',
      '  "5D":  { timeframe: "30m", limit: 65  },',
      '  "1M":  { timeframe: "1D",  limit: 22  },',
      '  "3M":  { timeframe: "1D",  limit: 66  },',
      '  "6M":  { timeframe: "1D",  limit: 132 },',
      '  "YTD": { timeframe: "1D",  limit: 120 },',
      '  "1Y":  { timeframe: "1W",  limit: 52  },',
      '  "5Y":  { timeframe: "1W",  limit: 260 },',
      '  "All": { timeframe: "1M",  limit: 120 },',
      "};",
    ].join("\n");

    if (!src.includes(anchor)) {
      throw new Error("Could not find ScreenerFiltersInput import anchor");
    }
    src = src.replace(anchor, block);
  }

  if (!src.includes("export async function chartData(req: Request, res: Response)")) {
    const fn = `\n\nexport async function chartData(req: Request, res: Response) {\n  try {\n    const rawSymbols = (req.query.symbols as string) || \"\";\n    const period = (req.query.period as string) || \"5D\";\n    const fromParam = req.query.from as string | undefined;\n    const toParam = req.query.to as string | undefined;\n    const symbols = rawSymbols\n      .split(\",\")\n      .map((s) => s.trim())\n      .filter((s) => s.length > 0)\n      .slice(0, 50);\n\n    if (!symbols.length) return res.json({});\n\n    let chartQuery: { timeframe: string; limit: number };\n    if (fromParam && toParam) {\n      const fromMs = new Date(fromParam).getTime();\n      const toMs = new Date(toParam).getTime();\n      const daysDiff = Math.ceil((toMs - fromMs) / (1000 * 60 * 60 * 24));\n      if (daysDiff <= 5) chartQuery = { timeframe: \"5m\", limit: daysDiff * 78 };\n      else if (daysDiff <= 30) chartQuery = { timeframe: \"30m\", limit: daysDiff * 13 };\n      else if (daysDiff <= 365) chartQuery = { timeframe: \"1D\", limit: daysDiff };\n      else chartQuery = { timeframe: \"1W\", limit: Math.ceil(daysDiff / 7) };\n      chartQuery.limit = Math.min(chartQuery.limit, 2000);\n    } else {\n      chartQuery = PERIOD_CHART_MAP[period] ?? PERIOD_CHART_MAP[\"5D\"];\n    }\n\n    const chartServiceBase = (CONFIG.chartServiceUrl ?? \"http://127.0.0.1:3001\")\n      .replace(/\\/api\\/chart.*$/, \"\")\n      .replace(/\\/$/, \"\");\n\n    let candlesBySymbol: Record<string, OHLCVCandle[]> = {};\n    try {\n      const ctrl = new AbortController();\n      const timer = setTimeout(() => ctrl.abort(), 30000);\n      const CHART_BATCH = 25;\n      const batches: string[][] = [];\n      for (let i = 0; i < symbols.length; i += CHART_BATCH) {\n        batches.push(symbols.slice(i, i + CHART_BATCH));\n      }\n\n      await Promise.all(\n        batches.map(async (batch) => {\n          const body = JSON.stringify({\n            symbols: batch,\n            timeframe: chartQuery.timeframe,\n            limit: chartQuery.limit,\n          });\n\n          const chartResp = await fetch(chartServiceBase + "/api/chart/multi", {\n            method: \"POST\",\n            headers: { \"Content-Type\": \"application/json\" },\n            body,\n            signal: ctrl.signal,\n          });\n\n          if (chartResp.ok) {\n            const json = (await chartResp.json()) as { ok?: boolean; data?: Record<string, OHLCVCandle[]> };\n            if (json?.ok && json.data) {\n              Object.assign(candlesBySymbol, json.data);\n            }\n          } else {\n            logger.warn(\"screener_chart_service_non_ok\", { status: chartResp.status });\n          }\n        })\n      );\n\n      clearTimeout(timer);\n    } catch (err) {\n      logger.warn(\"screener_chart_service_error\", { error: (err as Error).message });\n    }\n\n    const docs = await CleanAssetModel.find({\n      $or: [{ fullSymbol: { $in: symbols } }, { symbol: { $in: symbols } }],\n    })\n      .select(\"symbol fullSymbol price changePercent\")\n      .lean();\n\n    const docMap = new Map<string, { price: number; changePercent: number }>();\n    for (const doc of docs) {\n      const d = doc as unknown as { symbol: string; fullSymbol?: string; price?: number; changePercent?: number };\n      const key = symbols.find((s) => s === d.fullSymbol) ?? d.symbol;\n      docMap.set(key, { price: d.price ?? 0, changePercent: d.changePercent ?? 0 });\n    }\n\n    const result: Record<string, unknown> = {};\n    for (const sym of symbols) {\n      const meta = docMap.get(sym) ?? { price: 0, changePercent: 0 };\n      const ohlcvs = candlesBySymbol[sym] ?? [];\n      const candles = ohlcvs\n        .filter((c) => c.timestamp && Number.isFinite(c.close) && c.close > 0)\n        .map((c) => ({\n          time: new Date(c.timestamp).toISOString(),\n          open: c.open,\n          high: c.high,\n          low: c.low,\n          close: c.close,\n          volume: c.volume,\n        }));\n\n      result[sym] = {\n        symbol: sym,\n        currentPrice: meta.price,\n        changePercent: meta.changePercent,\n        candles,\n      };\n    }\n\n    return res.json(result);\n  } catch (err) {\n    logger.error(\"screener_chart_data_error\", { error: (err as Error).message });\n    return res.status(500).json({ error: \"Internal server error\" });\n  }\n}\n`;

    src += fn;
  }

  fs.writeFileSync(controllerPath, src, "utf8");
}

patchRoutes();
patchController();
console.log("Patched screener chart-data route and controller");

