/**
 * @tradereplay/charts — Chart Factory
 *
 * High-level factory functions that wrap `createChart` with TradingReplay-specific
 * defaults. Use these instead of calling `createChart` directly in your app.
 *
 * @example
 * ```ts
 * import { createTradingChart, resizeChartSurface } from '@tradereplay/charts';
 *
 * const chart = createTradingChart(containerEl, { parityMode: true });
 * resizeChartSurface(chart, containerEl, overlayCanvas);
 * ```
 */

import { createChart, type IChartApi, type UTCTimestamp } from '../lib/createChart.js';

export interface TradingChartOptions {
  /**
   * Enables TradingView-parity mode: slightly darker background, tighter right-offset,
   * and parity-specific series colours. Set to `true` for the simulation / full-chart page.
   */
  parityMode?: boolean;
  /**
   * `'normal'` = standard chart with scroll/zoom.
   * `'full'`   = full-screen chart with wider time scale right-offset.
   */
  viewMode?: 'normal' | 'full';
  /**
   * When `true` the chart becomes view-only: mouse-wheel and drag-pan are disabled,
   * grid lines are hidden. Use on overview / thumbnail charts.
   */
  passive?: boolean;
}

/**
 * Creates a fully configured TradingReplay chart instance.
 * Wraps `createChart` with sensible defaults for background colour, grid, crosshair,
 * price-scale, and time-scale settings so every chart in the app looks consistent.
 */
export function createTradingChart(container: HTMLElement, options?: TradingChartOptions): IChartApi {
  const parityMode = options?.parityMode ?? false;
  const viewMode   = options?.viewMode   ?? 'normal';
  const passive    = options?.passive    ?? false;

  const backgroundColor = parityMode ? '#0f0f0f' : '#131722';
  const gridColor       = parityMode ? 'rgba(42,46,57,0.42)' : 'rgba(42,46,57,0.72)';
  const axisColor       = parityMode ? 'rgba(42,46,57,0.62)' : 'rgba(42,46,57,0.95)';
  const rightOffset     = parityMode ? 1.8 : 2;

  return createChart(container, {
    autoSize: false,
    layout: {
      background: { type: 'solid', color: backgroundColor },
      textColor: '#b2b5be',
      fontFamily: 'Trebuchet MS, Arial, sans-serif',
      fontSize: 12,
    },
    grid: {
      vertLines: { color: passive ? 'transparent' : gridColor, visible: !passive } as object,
      horzLines: { color: passive ? 'rgba(42,46,57,0.28)' : gridColor },
    },
    crosshair: {
      mode: 0,
      vertLine: { color: 'rgba(120,123,134,0.8)', width: 1, style: 2, labelBackgroundColor: '#131722', labelVisible: true } as object,
      horzLine: { color: 'rgba(120,123,134,0.8)', width: 1, style: 2, labelBackgroundColor: '#131722', labelVisible: true } as object,
    },
    rightPriceScale: {
      borderColor: axisColor,
      borderVisible: !passive,
    } as object,
    timeScale: {
      borderColor: axisColor,
      borderVisible: !passive,
      timeVisible: true,
      secondsVisible: false,
      rightBarStaysOnScroll: true,
      shiftVisibleRangeOnNewBar: false,
      rightOffset,
    } as object,
    handleScale: {
      axisPressedMouseMove: { time: true, price: true },
      mouseWheel: !passive,
      pinch: !passive,
    },
    handleScroll: {
      mouseWheel: !passive,
      pressedMouseMove: !passive,
      vertTouchDrag: false,
      horzTouchDrag: !passive,
    },
    parity: parityMode
      ? { enabled: true, viewMode }
      : undefined,
  });
}

/**
 * Resizes both the chart canvas and the overlay canvas to the container's current size,
 * accounting for `devicePixelRatio` for crisp rendering on HiDPI screens.
 * Call inside a `ResizeObserver` callback or after any layout change.
 */
export function resizeChartSurface(
  chart: IChartApi,
  container: HTMLElement,
  overlay: HTMLCanvasElement,
): void {
  const w = container.clientWidth;
  const h = container.clientHeight;
  chart.applyOptions({ width: w, height: h });

  const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
  overlay.width  = Math.max(1, Math.round(w * dpr));
  overlay.height = Math.max(1, Math.round(h * dpr));
  overlay.style.width  = `${w}px`;
  overlay.style.height = `${h}px`;

  const ctx = overlay.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Fits all data bars to fill the container width from left to right.
 *
 * - Reserves ~60px for the right price-scale axis.
 * - Computes `barSpacing` so `numBars × barSpacing ≈ available canvas width`.
 * - Caps `barSpacing` at 12px to prevent overly wide bars on small datasets.
 * - Removes `fixLeftEdge` / `fixRightEdge` constraints.
 * - Calls `setVisibleRange` to pin `firstTime → lastTime` to the container edges.
 *
 * Call after `setData()` and inside a `ResizeObserver` / `requestAnimationFrame`
 * to guarantee correct sizing even when the container hasn't settled yet.
 */
export function fitChartContent(
  chart: IChartApi,
  container: HTMLElement,
  firstTime: UTCTimestamp,
  lastTime: UTCTimestamp,
  numBars: number,
): void {
  const width = container.clientWidth;
  if (!width || numBars < 2) return;

  // Reserve ~60px for the right price-scale axis
  const PRICE_SCALE_W = 60;
  const available   = Math.max(1, width - PRICE_SCALE_W);
  const barSpacing  = Math.max(0.5, Math.min(available / numBars, 12));

  chart.timeScale().applyOptions({
    barSpacing,
    rightOffset: 0,
    fixLeftEdge: false,
    fixRightEdge: false,
  });

  try {
    chart.timeScale().setVisibleRange({ from: firstTime, to: lastTime });
  } catch {
    // Fails when data isn't populated yet — barSpacing alone still improves layout.
  }
}
