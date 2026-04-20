export type TransformOhlc = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

function inferBoxSize(rows: readonly TransformOhlc[]): number {
  if (!rows.length) return 1;
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    const range = Math.abs(row.high - row.low);
    if (range > 0) {
      sum += range;
      count++;
    }
  }
  return Math.max(0.01, count > 0 ? (sum / count) * 0.6 : Math.abs(rows[0].close) * 0.005 || 1);
}

function mkRow(time: number, open: number, close: number, volume = 0): TransformOhlc {
  return {
    time,
    open,
    close,
    high: Math.max(open, close),
    low: Math.min(open, close),
    volume,
  };
}

export function renkoTransform(rows: readonly TransformOhlc[], boxSize = inferBoxSize(rows)): TransformOhlc[] {
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

export function rangeBarsTransform(rows: readonly TransformOhlc[], rangeSize = inferBoxSize(rows)): TransformOhlc[] {
  if (!rows.length) return [];
  const out: TransformOhlc[] = [];
  let cur = { ...rows[0] };

  for (let i = 1; i < rows.length; i++) {
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

export function lineBreakTransform(rows: readonly TransformOhlc[], lines = 3): TransformOhlc[] {
  if (!rows.length) return [];
  const out: TransformOhlc[] = [mkRow(rows[0].time, rows[0].open, rows[0].close, rows[0].volume ?? 0)];

  for (let i = 1; i < rows.length; i++) {
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

export function kagiTransform(rows: readonly TransformOhlc[], reversal = inferBoxSize(rows) * 2): TransformOhlc[] {
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
    } else {
      if (move <= 0) {
        out.push(mkRow(row.time, pivot, row.close, row.volume ?? 0));
        pivot = row.close;
      } else if (Math.abs(move) >= reversal) {
        direction = 1;
        out.push(mkRow(row.time, pivot, row.close, row.volume ?? 0));
        pivot = row.close;
      }
    }
  }

  if (!out.length) out.push(mkRow(rows[0].time, rows[0].open, rows[rows.length - 1].close, rows[rows.length - 1].volume ?? 0));
  return out;
}

export function pointFigureTransform(rows: readonly TransformOhlc[], boxSize = inferBoxSize(rows), reversalBoxes = 3): TransformOhlc[] {
  if (!rows.length) return [];
  const out: TransformOhlc[] = [];
  let columnDir: 1 | -1 = 1;
  let columnStart = rows[0].close;
  let columnEnd = rows[0].close;

  for (const row of rows) {
    const change = row.close - columnEnd;
    if (columnDir === 1) {
      if (change >= boxSize) {
        const boxes = Math.floor(change / boxSize);
        for (let i = 0; i < boxes; i++) {
          const next = columnEnd + boxSize;
          out.push(mkRow(row.time, columnEnd, next, row.volume ?? 0));
          columnEnd = next;
        }
      } else if (change <= -boxSize * reversalBoxes) {
        columnDir = -1;
        columnStart = columnEnd;
        const boxes = Math.floor(Math.abs(change) / boxSize);
        for (let i = 0; i < boxes; i++) {
          const next = columnEnd - boxSize;
          out.push(mkRow(row.time, columnEnd, next, row.volume ?? 0));
          columnEnd = next;
        }
      }
    } else {
      if (change <= -boxSize) {
        const boxes = Math.floor(Math.abs(change) / boxSize);
        for (let i = 0; i < boxes; i++) {
          const next = columnEnd - boxSize;
          out.push(mkRow(row.time, columnEnd, next, row.volume ?? 0));
          columnEnd = next;
        }
      } else if (change >= boxSize * reversalBoxes) {
        columnDir = 1;
        columnStart = columnEnd;
        const boxes = Math.floor(change / boxSize);
        for (let i = 0; i < boxes; i++) {
          const next = columnEnd + boxSize;
          out.push(mkRow(row.time, columnEnd, next, row.volume ?? 0));
          columnEnd = next;
        }
      }
    }

    if (Math.abs(columnEnd - columnStart) >= boxSize) {
      columnStart = columnEnd;
    }
  }

  if (!out.length) out.push(mkRow(rows[0].time, rows[0].open, rows[rows.length - 1].close, rows[rows.length - 1].volume ?? 0));
  return out;
}

export function brickTransform(rows: readonly TransformOhlc[], boxSize = inferBoxSize(rows) * 0.75): TransformOhlc[] {
  return renkoTransform(rows, boxSize);
}
