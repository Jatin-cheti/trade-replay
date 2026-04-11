import { Camera, ChevronDown, Magnet, Redo2, Undo2 } from 'lucide-react';
import type { ChartType } from '@/services/chart/dataTransforms';
import { chartTypeGroups, chartTypeLabels } from '@/services/chart/dataTransforms';
import type { CrosshairSnapMode } from '@/hooks/useChart';

type ChartTopBarProps = {
  chartType: ChartType;
  setChartType: (value: ChartType) => void;
  magnetMode: boolean;
  setMagnetMode: (value: boolean) => void;
  crosshairSnapMode: CrosshairSnapMode;
  setCrosshairSnapMode: (value: CrosshairSnapMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  optionsOpen: boolean;
  setOptionsOpen: (value: boolean) => void;
  indicatorsOpen: boolean;
  setIndicatorsOpen: (value: boolean) => void;
  activeIndicatorsCount: number;
  treeOpen: boolean;
  setTreeOpen: (value: boolean) => void;
  selectedDrawingVariant?: string | null;
  isMobile: boolean;
};

const snapLabels: Record<CrosshairSnapMode, string> = {
  free: 'Free',
  time: 'Time',
  ohlc: 'OHLC',
};

export default function ChartTopBar({
  chartType,
  setChartType,
  magnetMode,
  setMagnetMode,
  crosshairSnapMode,
  setCrosshairSnapMode,
  onUndo,
  onRedo,
  onClear,
  onExportPng,
  optionsOpen,
  setOptionsOpen,
  indicatorsOpen,
  setIndicatorsOpen,
  activeIndicatorsCount,
  treeOpen,
  setTreeOpen,
  selectedDrawingVariant,
  isMobile,
}: ChartTopBarProps) {
  const allTypes = chartTypeGroups.flatMap((g) => g.types);

  return (
    <div
      data-testid="chart-top-bar"
      className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-primary/15 bg-background/60 px-2 py-1.5 backdrop-blur-xl"
    >
      {/* Chart type dropdown */}
      <div className="relative" data-testid="charttype-dropdown">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-semibold text-foreground hover:bg-primary/10"
          onClick={(e) => {
            const menu = e.currentTarget.nextElementSibling as HTMLElement;
            menu.classList.toggle('hidden');
          }}
        >
          {chartTypeLabels[chartType]}
          <ChevronDown size={12} />
        </button>
        <div className="absolute left-0 top-full z-[70] mt-1 hidden max-h-[70vh] w-[220px] overflow-y-auto rounded-xl border border-primary/25 bg-background/95 p-1 shadow-xl shadow-black/40 backdrop-blur-xl">
          {chartTypeGroups.map((group) => (
            <div key={group.id}>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{group.label}</div>
              {group.types.map((type) => (
                <button
                  key={type}
                  type="button"
                  data-testid={`chart-type-${type}`}
                  onClick={(e) => {
                    setChartType(type);
                    // close dropdown
                    (e.currentTarget.closest('[data-testid="charttype-dropdown"]')?.querySelector('.absolute') as HTMLElement)?.classList.add('hidden');
                  }}
                  className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-[12px] transition ${
                    chartType === type
                      ? 'bg-primary/20 font-semibold text-primary'
                      : 'text-foreground hover:bg-primary/10'
                  }`}
                >
                  {chartTypeLabels[type]}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <span className="h-4 w-px bg-border/40" />

      {/* Undo / Redo */}
      <button type="button" data-testid="toolbar-undo" onClick={onUndo} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-foreground" title="Undo">
        <Undo2 size={15} />
      </button>
      <button type="button" data-testid="toolbar-redo" onClick={onRedo} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-foreground" title="Redo">
        <Redo2 size={15} />
      </button>

      <span className="h-4 w-px bg-border/40" />

      {/* Magnet */}
      <button
        type="button"
        data-testid="toolbar-magnet"
        onClick={() => setMagnetMode(!magnetMode)}
        className={`rounded-md p-1.5 transition ${magnetMode ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`}
        title="Magnet mode"
      >
        <Magnet size={15} />
      </button>

      {/* Snap mode */}
      <div className="relative" data-testid="snap-dropdown-wrapper">
        <button
          type="button"
          data-testid="snap-dropdown"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          onClick={(e) => {
            const menu = e.currentTarget.nextElementSibling as HTMLElement;
            menu.classList.toggle('hidden');
          }}
        >
          Snap: {snapLabels[crosshairSnapMode]}
          <ChevronDown size={11} />
        </button>
        <div className="absolute left-0 top-full z-[70] mt-1 hidden w-[130px] rounded-xl border border-primary/25 bg-background/95 p-1 shadow-xl shadow-black/40 backdrop-blur-xl">
          {(['free', 'time', 'ohlc'] as CrosshairSnapMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={(e) => {
                setCrosshairSnapMode(mode);
                (e.currentTarget.closest('[data-testid="snap-dropdown-wrapper"]')?.querySelector('.absolute') as HTMLElement)?.classList.add('hidden');
              }}
              className={`flex w-full rounded-md px-2.5 py-1.5 text-[12px] transition ${
                crosshairSnapMode === mode ? 'bg-primary/20 font-semibold text-primary' : 'text-foreground hover:bg-primary/10'
              }`}
            >
              {snapLabels[mode]}
            </button>
          ))}
        </div>
      </div>

      <span className="h-4 w-px bg-border/40" />

      {/* Indicators */}
      <button
        type="button"
        data-testid="indicators-button"
        onClick={() => setIndicatorsOpen(!indicatorsOpen)}
        className={`rounded-md px-2 py-1.5 text-[12px] font-semibold transition ${
          indicatorsOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
        }`}
      >
        Indicators{activeIndicatorsCount > 0 ? ` (${activeIndicatorsCount})` : ''}
      </button>

      {/* Options */}
      <button
        type="button"
        onClick={() => setOptionsOpen(!optionsOpen)}
        className={`rounded-md px-2 py-1.5 text-[12px] font-semibold transition ${
          optionsOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
        }`}
      >
        Options
      </button>

      {/* Objects */}
      <button
        type="button"
        onClick={() => setTreeOpen(!treeOpen)}
        className={`rounded-md px-2 py-1.5 text-[12px] font-semibold transition ${
          treeOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
        }`}
      >
        Objects
      </button>

      <span className="h-4 w-px bg-border/40" />

      {/* Export */}
      <button type="button" data-testid="chart-export-png" onClick={onExportPng} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-foreground" title="Export PNG">
        <Camera size={15} />
      </button>

      {/* Clear */}
      <button type="button" data-testid="chart-clear" onClick={onClear} className="rounded-md px-2 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-destructive/20 hover:text-destructive" title="Clear all drawings">
        Clear
      </button>

      {/* Active drawing indicator */}
      {selectedDrawingVariant && (
        <span className="ml-auto rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary/80" data-testid="selected-tool-indicator">
          {selectedDrawingVariant}
        </span>
      )}
    </div>
  );
}
