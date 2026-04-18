import { bollinger } from "./bollinger";
import { macd } from "./macd";
import { dema, ema, sma, tema, wma } from "./moving-averages";
import { cci, rsi, stochastic, williamsR } from "./oscillators";
import { adx, aroon, supertrend } from "./trend";
import { cmf, mfi, obv, volumeRsi, vwap } from "./volume";
import { atr, standardDeviation } from "./volatility";

export const indicatorRegistry = {
  sma,
  ema,
  wma,
  dema,
  tema,
  rsi,
  stochastic,
  cci,
  williamsR,
  macd,
  bollinger,
  obv,
  vwap,
  cmf,
  mfi,
  volumeRsi,
  atr,
  standardDeviation,
  adx,
  aroon,
  supertrend,
};

export type IndicatorRegistry = typeof indicatorRegistry;
