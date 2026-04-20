import { getAlphaVantageCandles } from "./alphaVantage";
import { getFallbackCandles } from "./fallbackData";
import { fetchYahooIntradayCandles } from "./yahooMarketData";
import { CandleData, ScenarioId } from "../types/shared";

function filterByDateRange(candles: CandleData[], startDate?: string, endDate?: string): CandleData[] {
  return candles.filter((candle) => {
    if (startDate && candle.time < startDate) return false;
    if (endDate && candle.time > endDate) return false;
    return true;
  });
}

export async function loadCandlesForSimulation(input: {
  scenarioId: ScenarioId;
  symbol: string;
  startDate?: string;
  endDate?: string;
  dataMode?: "default" | "parity-live";
}): Promise<{ candles: CandleData[]; source: "alpha-vantage" | "fallback" | "yahoo-intraday" }> {
  if (input.dataMode === "parity-live") {
    const yahoo = await fetchYahooIntradayCandles({
      symbol: input.symbol,
      interval: "1m",
      range: "1d",
    });

    if (yahoo && yahoo.length > 0) {
      return {
        candles: filterByDateRange(yahoo, input.startDate, input.endDate),
        source: "yahoo-intraday",
      };
    }
  }

  try {
    const alpha = await getAlphaVantageCandles(input.symbol, input.startDate, input.endDate);
    if (alpha && alpha.length > 0) {
      return { candles: alpha, source: "alpha-vantage" };
    }
  } catch (_error) {
    // Explicitly fall back to local pre-seeded data when API fails.
  }

  return {
    candles: filterByDateRange(
      getFallbackCandles(input.scenarioId, input.symbol, input.startDate, input.endDate),
      input.startDate,
      input.endDate,
    ),
    source: "fallback",
  };
}
