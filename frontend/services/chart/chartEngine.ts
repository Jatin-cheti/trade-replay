import { createChart, type IChartApi } from '@tradereplay/charts';

export function createTradingChart(container: HTMLElement): IChartApi {
  return createChart(container, {
    autoSize: false,
    layout: {
      background: { type: 'solid', color: 'rgba(9, 17, 32, 0.85)' },
      textColor: 'rgba(173, 192, 225, 0.88)',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11,
    },
    grid: {
      vertLines: { color: 'rgba(38, 56, 84, 0.48)' },
      horzLines: { color: 'rgba(38, 56, 84, 0.48)' },
    },
    crosshair: {
      mode: 0,
      vertLine: {
        color: 'rgba(0, 209, 255, 0.72)',
        width: 1,
        style: 2,
        labelBackgroundColor: '#00d1ff',
      },
      horzLine: {
        color: 'rgba(255, 0, 0, 0.65)',
        width: 1,
        style: 2,
        labelBackgroundColor: '#ff0000',
      },
    },
    rightPriceScale: {
      borderColor: 'rgba(56, 80, 117, 0.55)',
    },
    timeScale: {
      borderColor: 'rgba(56, 80, 117, 0.55)',
      timeVisible: true,
      secondsVisible: false,
      rightBarStaysOnScroll: true,
      shiftVisibleRangeOnNewBar: false,
      rightOffset: 0,
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
  });
}

export function resizeChartSurface(
  chart: IChartApi,
  container: HTMLElement,
  overlay: HTMLCanvasElement
): void {
  chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });

  const dpr = window.devicePixelRatio || 1;
  overlay.width = Math.floor(container.clientWidth * dpr);
  overlay.height = Math.floor(container.clientHeight * dpr);
  overlay.style.width = `${container.clientWidth}px`;
  overlay.style.height = `${container.clientHeight}px`;

  const ctx = overlay.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
