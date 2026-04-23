import { createChart, type IChartApi, type UTCTimestamp } from '@tradereplay/charts';

type TradingChartEngineOptions = {
  parityMode?: boolean;
  viewMode?: 'normal' | 'full';
  /**
   * When true, the chart becomes passive to mouse-wheel and drag-pan events.
   * Used on the Symbol Page overview where the chart is view-only and the
   * user expects the page (not the chart) to scroll.
   */
  passive?: boolean;
};

export function createTradingChart(container: HTMLElement, options?: TradingChartEngineOptions): IChartApi {
  const parityMode = options?.parityMode ?? false;
  const viewMode = options?.viewMode ?? 'normal';
  const passive = options?.passive ?? false;
  const backgroundColor = parityMode ? '#0f0f0f' : '#131722';
  const gridColor = parityMode ? 'rgba(42, 46, 57, 0.42)' : 'rgba(42, 46, 57, 0.72)';
  const passiveGridColor = 'rgba(42, 46, 57, 0.28)';
  const axisColor = parityMode ? 'rgba(42, 46, 57, 0.62)' : 'rgba(42, 46, 57, 0.95)';
  const rightOffset = parityMode ? 1.8 : 2;

  return createChart(container, {
    autoSize: false,
    layout: {
      background: { type: 'solid', color: backgroundColor },
      textColor: '#b2b5be',
      fontFamily: 'Trebuchet MS, Arial, sans-serif',
      fontSize: 12,
    },
    grid: {
      vertLines: { color: passive ? 'transparent' : gridColor, visible: !passive },
      horzLines: { color: passive ? passiveGridColor : gridColor },
    },
    crosshair: {
      mode: 0,
      vertLine: {
        color: 'rgba(120, 123, 134, 0.8)',
        width: 1,
        style: 2,
        labelBackgroundColor: '#131722',
        labelVisible: true,
      },
      horzLine: {
        color: 'rgba(120, 123, 134, 0.8)',
        width: 1,
        style: 2,
        labelBackgroundColor: '#131722',
        labelVisible: true,
      },
    },
    rightPriceScale: {
      borderColor: axisColor,
      borderVisible: !passive,
    },
    timeScale: {
      borderColor: axisColor,
      borderVisible: !passive,
      timeVisible: true,
      secondsVisible: false,
      rightBarStaysOnScroll: true,
      shiftVisibleRangeOnNewBar: false,
      rightOffset,
    },
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
      ? {
          enabled: true,
          viewMode,
        }
      : undefined,
  });
}

export function resizeChartSurface(
  chart: IChartApi,
  container: HTMLElement,
  overlay: HTMLCanvasElement
): void {
  chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });

  const dpr = window.devicePixelRatio || 1;
  overlay.width = Math.max(1, Math.round(container.clientWidth * dpr));
  overlay.height = Math.max(1, Math.round(container.clientHeight * dpr));
  overlay.style.width = `${container.clientWidth}px`;
  overlay.style.height = `${container.clientHeight}px`;

  const ctx = overlay.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Fits all data bars to fill the container width from left to right.
 * Call this after setting series data AND inside ResizeObserver / requestAnimationFrame
 * to guarantee correct sizing even when the container width isn't yet settled.
 *
 * - Sets barSpacing so (numBars × barSpacing) fills the available canvas width.
 * - Removes fixLeftEdge / fixRightEdge so setVisibleRange can position freely.
 * - Calls setVisibleRange to pin firstTime → lastTime to the container edges.
 */
export function fitChartContent(
  chart: IChartApi,
  container: HTMLElement,
  firstTime: UTCTimestamp,
  lastTime: UTCTimestamp,
  numBars: number,
): void {
  const width = container.clientWidth;
  if (width <= 0 || numBars < 2) return;

  // Reserve ~60 px for the right price-scale axis
  const PRICE_SCALE_W = 60;
  const available = Math.max(1, width - PRICE_SCALE_W);
  const barSpacing = Math.max(0.5, Math.min(available / numBars, 12));

  // Remove edge locks so setVisibleRange can position the view freely
  chart.timeScale().applyOptions({
    barSpacing,
    rightOffset: 0,
    fixLeftEdge: false,
    fixRightEdge: false,
  });

  try {
    chart.timeScale().setVisibleRange({ from: firstTime, to: lastTime });
  } catch {
    // Fails when data isn't populated yet — barSpacing alone still improves layout
  }
}
