type TransformOhlc = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type IndicatorRequest = {
  id: string;
  params?: Record<string, number>;
};

export type TransformType = "renko" | "rangeBars" | "lineBreak" | "kagi" | "pointFigure" | "brick";

function nullSeries(length: number): Array<number | null> {
  return new Array(length).fill(null);
}

function sma(values: number[], period: number): Array<number | null> {
  const out = nullSeries(values.length);
  if (period < 1 || values.length < period) return out;

  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }

  return out;
}

function ema(values: number[], period: number): Array<number | null> {
  const out = nullSeries(values.length);
  if (period < 1 || values.length < period) return out;

  const alpha = 2 / (period + 1);
  const seed = sma(values.slice(0, period), period)[period - 1];
  if (seed == null) return out;
  out[period - 1] = seed;

  let prev = seed;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * alpha + prev * (1 - alpha);
    out[i] = prev;
  }

  return out;
}

function rsi(values: number[], period: number): Array<number | null> {
  const out = nullSeries(values.length);
  if (period < 2 || values.length < period + 1) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    const up = delta > 0 ? delta : 0;
    const down = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + up) / period;
    avgLoss = (avgLoss * (period - 1) + down) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

function inferBoxSize(rows: readonly TransformOhlc[]): number {
  if (!rows.length) return 1;
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    const range = Math.abs(row.high - row.low);
    if (range > 0) {
      sum += range;
      count += 1;
    }
  }
  return Math.max(0.01, count > 0 ? (sum / count) * 0.6 : Math.abs(rows[0].close) * 0.005 || 1);
}

function mkRow(time: number, open: number, close: number, volume = 0): TransformOhlc {
  return { time, open, close, high: Math.max(open, close), low: Math.min(open, close), volume };
}

function renkoTransform(rows: readonly TransformOhlc[], boxSize = inferBoxSize(rows)): TransformOhlc[] {
  if (!rows.length) return [];
  const out: TransformOhlc[] = [];
  let brickClose = rows[0].close;
  let brickTime = rows[0].time;

  for (const row of rows) {
    let delta = row.close - brickClose;
    while (Math.abs(delta) >= boxSize) {
      const nextClose = brickClose + Math.sign(delta) * boxSize;
      out.push(mkRow(brickTime, brickClose, nextClose, row.volume ?? 0));
      brickClose = nextClose;
      brickTime = row.time;
      delta = row.close - brickClose;
    }
  }

  if (!out.length) out.push(mkRow(rows[0].time, rows[0].open, rows[rows.length - 1].close, rows[rows.length - 1].volume ?? 0));
  return out;
}

function rangeBarsTransform(rows: readonly TransformOhlc[], rangeSize = inferBoxSize(rows)): TransformOhlc[] {
  if (!rows.length) return [];
  const out: TransformOhlc[] = [];
  let cur = { ...rows[0] };

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    cur.high = Math.max(cur.high, row.high);
    cur.low = Math.min(cur.low, row.low);
    cur.close = row.close;
    cur.time = row.time;
    cur.volume = (cur.volume ?? 0) + (row.volume ?? 0);

    if (cur.high - cur.low >= rangeSize) {
      out.push({ ...cur });
      cur = { ...row };
    }
  }

  if (!out.length || out[out.length - 1].time !== cur.time) out.push({ ...cur });
  return out;
}

function lineBreakTransform(rows: readonly TransformOhlc[], lines = 3): TransformOhlc[] {
  if (!rows.length) return [];
  const out: TransformOhlc[] = [mkRow(rows[0].time, rows[0].open, rows[0].close, rows[0].volume ?? 0)];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const lookback = out.slice(Math.max(0, out.length - lines));
    const maxClose = Math.max(...lookback.map((item) => item.close));
    const minClose = Math.min(...lookback.map((item) => item.close));
    const lastClose = out[out.length - 1].close;
    if (row.close > maxClose || row.close < minClose) {
      out.push(mkRow(row.time, lastClose, row.close, row.volume ?? 0));
    }
  }

  return out;
}

function kagiTransform(rows: readonly TransformOhlc[], reversal = inferBoxSize(rows) * 2): TransformOhlc[] {
  if (!rows.length) return [];
  const out: TransformOhlc[] = [];
  let direction: 1 | -1 = rows[rows.length - 1].close >= rows[0].close ? 1 : -1;
  let pivot = rows[0].close;

  for (const row of rows) {
    const move = row.close - pivot;
    if (direction === 1) {
      if (move >= 0) {
        out.push(mkRow(row.time, pivot, row.close, row.volume ?? 0));
        pivot = row.close;
      } else if (Math.abs(move) >= reversal) {
        direction = -1;
        out.push(mkRow(row.time, pivot, row.close, row.volume ?? 0));
        pivot = row.close;
      }
    } else if (move <= 0) {
      out.push(mkRow(row.time, pivot, row.close, row.volume ?? 0));
      pivot = row.close;
    } else if (Math.abs(move) >= reversal) {
      direction = 1;
      out.push(mkRow(row.time, pivot, row.close, row.volume ?? 0));
      pivot = row.close;
    }
  }

  if (!out.length) out.push(mkRow(rows[0].time, rows[0].open, rows[rows.length - 1].close, rows[rows.length - 1].volume ?? 0));
  return out;
}

function pointFigureTransform(rows: readonly TransformOhlc[], boxSize = inferBoxSize(rows), reversalBoxes = 3): TransformOhlc[] {
  if (!rows.length) return [];
  const out: TransformOhlc[] = [];
  let columnDir: 1 | -1 = 1;
  let columnEnd = rows[0].close;

  for (const row of rows) {
    const change = row.close - columnEnd;
    if (columnDir === 1) {
      if (change >= boxSize) {
        const boxes = Math.floor(change / boxSize);
        for (let i = 0; i < boxes; i += 1) {
          const next = columnEnd + boxSize;
          out.push(mkRow(row.time, columnEnd, next, row.volume ?? 0));
          columnEnd = next;
        }
      } else if (change <= -boxSize * reversalBoxes) {
        columnDir = -1;
        const boxes = Math.floor(Math.abs(change) / boxSize);
        for (let i = 0; i < boxes; i += 1) {
          const next = columnEnd - boxSize;
          out.push(mkRow(row.time, columnEnd, next, row.volume ?? 0));
          columnEnd = next;
        }
      }
    } else if (change <= -boxSize) {
      const boxes = Math.floor(Math.abs(change) / boxSize);
      for (let i = 0; i < boxes; i += 1) {
        const next = columnEnd - boxSize;
        out.push(mkRow(row.time, columnEnd, next, row.volume ?? 0));
        columnEnd = next;
      }
    } else if (change >= boxSize * reversalBoxes) {
      columnDir = 1;
      const boxes = Math.floor(change / boxSize);
      for (let i = 0; i < boxes; i += 1) {
        const next = columnEnd + boxSize;
        out.push(mkRow(row.time, columnEnd, next, row.volume ?? 0));
        columnEnd = next;
      }
    }
  }

  if (!out.length) out.push(mkRow(rows[0].time, rows[0].open, rows[rows.length - 1].close, rows[rows.length - 1].volume ?? 0));
  return out;
}

function brickTransform(rows: readonly TransformOhlc[], boxSize = inferBoxSize(rows) * 0.75): TransformOhlc[] {
  return renkoTransform(rows, boxSize);
}

function normalizeCandles(candles: ChartCandle[]): TransformOhlc[] {
  return candles
    .map((row) => ({
      time: Number(row.time),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: row.volume == null ? undefined : Number(row.volume),
    }))
    .filter((row) => Number.isFinite(row.time) && Number.isFinite(row.open) && Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close));
}

export function computeIndicatorsLocal(input: { candles: ChartCandle[]; indicators: IndicatorRequest[] }) {
  const candles = normalizeCandles(input.candles);
  const close = candles.map((c) => c.close);

  const indicatorResults = input.indicators.map((item) => {
    if (item.id === "sma") {
      const period = Math.max(1, Math.round(Number(item.params?.period ?? 20)));
      return {
        id: "sma",
        name: "Simple Moving Average",
        params: { period },
        outputs: [{ name: "sma", seriesType: "Line", pane: "overlay", color: "#f7b731", values: sma(close, period) }],
      };
    }

    if (item.id === "ema") {
      const period = Math.max(1, Math.round(Number(item.params?.period ?? 20)));
      return {
        id: "ema",
        name: "Exponential Moving Average",
        params: { period },
        outputs: [{ name: "ema", seriesType: "Line", pane: "overlay", color: "#a29bfe", values: ema(close, period) }],
      };
    }

    if (item.id === "rsi") {
      const period = Math.max(2, Math.round(Number(item.params?.period ?? 14)));
      return {
        id: "rsi",
        name: "Relative Strength Index",
        params: { period },
        outputs: [{ name: "rsi", seriesType: "Line", pane: "subpane", color: "#e84393", values: rsi(close, period) }],
      };
    }

    if (item.id === "macd") {
      const fast = Math.max(1, Math.round(Number(item.params?.fast ?? 12)));
      const slow = Math.max(1, Math.round(Number(item.params?.slow ?? 26)));
      const signal = Math.max(1, Math.round(Number(item.params?.signal ?? 9)));
      const fastLine = ema(close, fast);
      const slowLine = ema(close, slow);
      const macd = nullSeries(close.length);
      for (let i = 0; i < close.length; i += 1) {
        if (fastLine[i] != null && slowLine[i] != null) {
          macd[i] = (fastLine[i] ?? 0) - (slowLine[i] ?? 0);
        }
      }
      const signalLine = ema(macd.map((v) => v ?? 0), signal);
      const histogram = nullSeries(close.length);
      for (let i = 0; i < close.length; i += 1) {
        if (macd[i] != null && signalLine[i] != null) {
          histogram[i] = (macd[i] ?? 0) - (signalLine[i] ?? 0);
        }
      }
      return {
        id: "macd",
        name: "MACD",
        params: { fast, slow, signal },
        outputs: [
          { name: "macd", seriesType: "Line", pane: "subpane", color: "#00d1ff", values: macd },
          { name: "signal", seriesType: "Line", pane: "subpane", color: "#ff9f43", values: signalLine },
          { name: "histogram", seriesType: "Histogram", pane: "subpane", color: "rgba(0,209,255,0.5)", base: 0, values: histogram },
        ],
      };
    }

    throw new Error(`UNKNOWN_INDICATOR:${item.id}`);
  });

  return {
    candlesCount: candles.length,
    indicators: indicatorResults,
  };
}

export function transformCandlesLocal(input: {
  candles: ChartCandle[];
  transformType: TransformType;
  params?: Record<string, number>;
}) {
  const candles = normalizeCandles(input.candles);
  let transformed: TransformOhlc[] = candles;

  switch (input.transformType) {
    case "renko":
      transformed = renkoTransform(candles, Number(input.params?.boxSize));
      break;
    case "rangeBars":
      transformed = rangeBarsTransform(candles, Number(input.params?.rangeSize));
      break;
    case "lineBreak":
      transformed = lineBreakTransform(candles, Math.max(2, Math.round(Number(input.params?.lines ?? 3))));
      break;
    case "kagi":
      transformed = kagiTransform(candles, Number(input.params?.reversal));
      break;
    case "pointFigure":
      transformed = pointFigureTransform(
        candles,
        Number(input.params?.boxSize),
        Math.max(2, Math.round(Number(input.params?.reversalBoxes ?? 3))),
      );
      break;
    case "brick":
      transformed = brickTransform(candles, Number(input.params?.boxSize));
      break;
    default:
      transformed = candles;
      break;
  }

  return {
    candlesCount: candles.length,
    transformedCount: transformed.length,
    transformType: input.transformType,
    candles: transformed,
  };
}
