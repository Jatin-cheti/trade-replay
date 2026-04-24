/**
 * Overlay canvas utilities — reusable helpers for any chart consumer
 * that renders an HTML canvas on top of a LightweightCharts chart.
 *
 * All functions are pure / side-effect-free with respect to React state
 * so they can be called safely inside useEffect and event handlers.
 */

// ─── Bar lookup ──────────────────────────────────────────────────────────────

/**
 * Return the index of the row whose `.time` value is nearest to `targetTime`.
 * Falls back to the last index when `rows` is empty.
 *
 * Use this instead of `Array.findIndex` with an exact-match, because the
 * chart's internal time-index may include synthetic timestamps (e.g. from
 * step-line transforms) that don't appear in the original row array.
 */
export function findNearestBarIndex<T extends { time: number }>(
  rows: T[],
  targetTime: number,
): number {
  if (!rows.length) return 0;
  let idx = rows.length - 1;
  let minDiff = Infinity;
  for (let i = 0; i < rows.length; i++) {
    const diff = Math.abs(rows[i].time - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      idx = i;
    }
  }
  return idx;
}

// ─── Canvas clear ────────────────────────────────────────────────────────────

/**
 * Clear the entire overlay canvas, honouring devicePixelRatio so logical
 * coordinates always match CSS pixels.
 */
export function clearOverlayCanvas(
  overlay: HTMLCanvasElement,
  dpr?: number,
): void {
  const ctx = overlay.getContext('2d');
  if (!ctx) return;
  const d = dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, overlay.width / d, overlay.height / d);
}

// ─── Crosshair dot ───────────────────────────────────────────────────────────

/**
 * Draw a filled circle on an overlay canvas at the given CSS-pixel coordinates.
 * Matches the TradingView "magnet" cursor dot style used across all screener
 * and chart card components.
 *
 * @param ctx      2D rendering context of the overlay canvas.
 * @param x        Dot centre X in CSS pixels (from `param.point.x`).
 * @param y        Dot centre Y in CSS pixels (from `series.priceToCoordinate`).
 * @param color    Fill colour (usually the series line colour).
 */
export function drawCrosshairDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#131722';
  ctx.stroke();
  ctx.restore();
}

// ─── Fallback sparkline ──────────────────────────────────────────────────────

/**
 * Draw a simple price sparkline directly onto a canvas element.
 * Used as a last-resort fallback when the full LightweightCharts instance
 * fails to initialise (e.g. unsupported browser, WebGL unavailable).
 *
 * Sizing is derived from the canvas's parent element; the canvas bitmap is
 * resized to match the CSS size × devicePixelRatio automatically.
 *
 * @param canvas    The overlay HTMLCanvasElement to draw into.
 * @param rows      OHLCV rows (only `close`, `high`, `low` are used).
 * @param lineColor Stroke colour for the sparkline.
 */
export function drawFallbackSparkline(
  canvas: HTMLCanvasElement,
  rows: Array<{ close: number; high: number; low: number }>,
  lineColor: string,
): void {
  const host = canvas.parentElement;
  if (!host) return;
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (width < 10 || height < 10 || rows.length < 2) return;

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    if (row.low < min) min = row.low;
    if (row.high > max) max = row.high;
  }
  const span = Math.max(0.000001, max - min);

  const lp = 8;
  const rp = 8;
  const tp = 8;
  const bp = 10;
  const plotW = Math.max(1, width - lp - rp);
  const plotH = Math.max(1, height - tp - bp);

  ctx.lineWidth = 2;
  ctx.strokeStyle = lineColor;
  ctx.beginPath();
  rows.forEach((row, i) => {
    const x = lp + (i / (rows.length - 1)) * plotW;
    const y = tp + (1 - (row.close - min) / span) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}
