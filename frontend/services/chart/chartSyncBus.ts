export interface SyncedLogicalRange {
  from: number;
  to: number;
}

export type ChartSyncEvent =
  | {
      type: "crosshair";
      sourceId: string;
      payload: { time: number; price: number | null } | null;
    }
  | {
      type: "range";
      sourceId: string;
      payload: SyncedLogicalRange | null;
    };

export interface ChartSyncBus {
  emit(event: ChartSyncEvent): void;
  subscribe(listener: (event: ChartSyncEvent) => void): () => void;
}

export function createChartSyncBus(): ChartSyncBus {
  const listeners = new Set<(event: ChartSyncEvent) => void>();

  return {
    emit(event) {
      for (const listener of listeners) {
        listener(event);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
