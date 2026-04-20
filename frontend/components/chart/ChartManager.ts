type CrosshairListener = (timestamp: number, sourceChartId: string) => void;

interface ChartRegistration {
  chartId: string;
  syncGroup: string;
  onCrosshair: CrosshairListener;
}

export class ChartManager {
  private readonly charts = new Map<string, ChartRegistration>();

  register(registration: ChartRegistration): void {
    this.charts.set(registration.chartId, registration);
  }

  unregister(chartId: string): void {
    this.charts.delete(chartId);
  }

  publishCrosshair(syncGroup: string, sourceChartId: string, timestamp: number): void {
    for (const chart of this.charts.values()) {
      if (chart.syncGroup !== syncGroup || chart.chartId === sourceChartId) {
        continue;
      }
      chart.onCrosshair(timestamp, sourceChartId);
    }
  }
}

export const globalChartManager = new ChartManager();
