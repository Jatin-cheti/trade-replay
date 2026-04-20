import { useState, useCallback, useMemo } from 'react';
import type { CandleData } from '@/data/stockData';
import ChartEngine from '@/components/chart/ChartEngine';

export type PaneLayout = '1' | '2h' | '2v' | '3' | '4';

const LAYOUT_LABELS: Record<PaneLayout, string> = {
  '1': '1×1',
  '2h': '1×2',
  '2v': '2×1',
  '3': '2+1',
  '4': '2×2',
};

const LAYOUT_GRIDS: Record<PaneLayout, string> = {
  '1': 'grid-cols-1 grid-rows-1',
  '2h': 'grid-cols-2 grid-rows-1',
  '2v': 'grid-cols-1 grid-rows-2',
  '3': 'grid-cols-2 grid-rows-2',
  '4': 'grid-cols-2 grid-rows-2',
};

function paneCount(layout: PaneLayout): number {
  if (layout === '1') return 1;
  if (layout === '2h' || layout === '2v') return 2;
  if (layout === '3') return 3;
  return 4;
}

interface SuperChartProps {
  data: CandleData[];
  visibleCount: number;
  symbol: string;
  mode?: 'simulation' | 'live';
}

export default function SuperChart({ data, visibleCount, symbol, mode = 'simulation' }: SuperChartProps) {
  const [layout, setLayout] = useState<PaneLayout>('1');
  const [activePane, setActivePane] = useState(0);
  const syncGroup = useMemo(() => `super-${symbol}`, [symbol]);

  const count = paneCount(layout);

  const handleLayoutChange = useCallback((next: PaneLayout) => {
    setLayout(next);
    setActivePane(0);
  }, []);

  return (
    <div className="flex h-full w-full flex-col gap-1">
      <div data-testid="super-chart-bar" className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-background/70 px-2 py-1 backdrop-blur-xl">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Layout</span>
        {(Object.keys(LAYOUT_LABELS) as PaneLayout[]).map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`layout-${key}`}
            onClick={() => handleLayoutChange(key)}
            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${layout === key ? 'border-primary/50 bg-primary/15 text-foreground' : 'border-border/60 bg-background/80 text-muted-foreground hover:border-primary/30 hover:bg-primary/10'}`}
          >
            {LAYOUT_LABELS[key]}
          </button>
        ))}
      </div>

      <div data-testid="super-chart-grid" className={`grid min-h-0 flex-1 gap-1 ${LAYOUT_GRIDS[layout]}`}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            data-testid={`super-pane-${i}`}
            onClick={() => setActivePane(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setActivePane(i);
            }}
            role="button"
            tabIndex={0}
            className={`relative min-h-[200px] overflow-hidden rounded-xl border transition-colors ${i === activePane ? 'border-primary/50 ring-1 ring-primary/25' : 'border-border/40'} ${layout === '3' && i === 0 ? 'row-span-2' : ''}`}
          >
            <ChartEngine
              data={data}
              visibleCount={visibleCount}
              symbol={symbol}
              timeframe="1m"
              mode={mode}
              syncGroup={syncGroup}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
