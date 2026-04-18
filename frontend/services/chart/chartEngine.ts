import { createChart, type IChartApi } from '@tradereplay/charts';

type TradingChartEngineOptions = {
  parityMode?: boolean;
  viewMode?: 'normal' | 'full';
};

export function createTradingChart(container: HTMLElement, options?: TradingChartEngineOptions): IChartApi {
  const parityMode = options?.parityMode ?? false;
  const viewMode = options?.viewMode ?? 'normal';
  const backgroundColor = parityMode ? '#0f0f0f' : '#131722';
  const gridColor = parityMode ? 'rgba(42, 46, 57, 0.42)' : 'rgba(42, 46, 57, 0.72)';
  const axisColor = parityMode ? 'rgba(42, 46, 57, 0.62)' : 'rgba(42, 46, 57, 0.95)';
  const rightOffset = parityMode ? 1.8 : 2;

  return createChart(container, {
    autoSize: false,
    layout: {
      background: { type: 'solid', color: backgroundColor },
      textColor: '#b2b5be',
      fontFamily: 'Trebuchet MS, Arial, sans-serif',
      fontSize: 11,
    },
    grid: {
      vertLines: { color: gridColor },
      horzLines: { color: gridColor },
    },
    crosshair: {
      mode: 0,
      vertLine: {
        color: 'rgba(120, 123, 134, 0.8)',
        width: 1,
        style: 2,
        labelBackgroundColor: '#787b86',
      },
      horzLine: {
        color: 'rgba(120, 123, 134, 0.8)',
        width: 1,
        style: 2,
        labelBackgroundColor: '#787b86',
      },
    },
    rightPriceScale: {
      borderColor: axisColor,
    },
    timeScale: {
      borderColor: axisColor,
      timeVisible: true,
      secondsVisible: false,
      rightBarStaysOnScroll: true,
      shiftVisibleRangeOnNewBar: false,
      rightOffset,
    },
    handleScale: {
      axisPressedMouseMove: { time: true, price: true },
      mouseWheel: true,
      pinch: true,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      vertTouchDrag: false,
      horzTouchDrag: true,
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
