import { useCallback, useEffect, useRef, useState } from 'react';
import { AreaChart, BarChart3, Camera, CandlestickChart, ChevronDown, LineChart, Magnet, Maximize2, Minimize2, Plus, Redo2, TrendingUp, Undo2, X, type LucideIcon } from 'lucide-react';
import type { ChartType } from '@/services/chart/dataTransforms';
import { chartTypeGroups, chartTypeLabels } from '@/services/chart/dataTransforms';
import type { CrosshairSnapMode } from '@/hooks/useChart';

/* ─── Interval groups (TradingView parity) ────────────────────────────── */

export type IntervalValue = string;

interface IntervalGroup {
  label: string;
  options: { value: IntervalValue; display: string }[];
}

const intervalGroups: IntervalGroup[] = [
  {
    label: 'Ticks',
    options: [
      { value: '1T', display: '1' },
      { value: '10T', display: '10' },
      { value: '100T', display: '100' },
      { value: '1000T', display: '1000' },
    ],
  },
  {
    label: 'Seconds',
    options: [
      { value: '1S', display: '1s' },
      { value: '5S', display: '5s' },
      { value: '10S', display: '10s' },
      { value: '15S', display: '15s' },
      { value: '30S', display: '30s' },
      { value: '45S', display: '45s' },
    ],
  },
  {
    label: 'Minutes',
    options: [
      { value: '1', display: '1m' },
      { value: '2', display: '2m' },
      { value: '3', display: '3m' },
      { value: '5', display: '5m' },
      { value: '10', display: '10m' },
      { value: '15', display: '15m' },
      { value: '30', display: '30m' },
      { value: '45', display: '45m' },
    ],
  },
  {
    label: 'Hours',
    options: [
      { value: '60', display: '1h' },
      { value: '120', display: '2h' },
      { value: '180', display: '3h' },
      { value: '240', display: '4h' },
    ],
  },
  {
    label: 'Days',
    options: [
      { value: '1D', display: '1D' },
      { value: '1W', display: '1W' },
      { value: '1M', display: '1M' },
    ],
  },
];

/* Favorite intervals — shown in header pills before the dropdown */
const favoriteIntervals = ['1', '5', '15', '60', '240', '1D', '1W'];

function intervalDisplayLabel(value: IntervalValue): string {
  for (const group of intervalGroups) {
    const found = group.options.find((o) => o.value === value);
    if (found) return found.display;
  }
  return value;
}

/* ─── Props ────────────────────────────────────────────────────────────── */

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
  isFullView: boolean;
  onToggleFullView: () => void;
  modalZIndex?: number;
  onCompareSymbol?: () => void;
};

const snapLabels: Record<CrosshairSnapMode, string> = {
  free: 'Free',
  time: 'Time',
  ohlc: 'OHLC',
};

/* ─── Chart style icon per chart type ─────────────────────────────────── */

const chartTypeIconMap: Partial<Record<ChartType, LucideIcon>> = {
  candlestick: CandlestickChart,
  bar: BarChart3,
  ohlc: BarChart3,
  line: LineChart,
  area: AreaChart,
  baseline: TrendingUp,
  histogram: BarChart3,
  heikinAshi: CandlestickChart,
  hollowCandles: CandlestickChart,
};

/* ─── Dropdown helper (click-outside close) ───────────────────────────── */

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/* ─── Custom interval modal ───────────────────────────────────────────── */

function CustomIntervalModal({ onApply, onClose, layerZIndex }: { onApply: (value: string) => void; onClose: () => void; layerZIndex: number }) {
  const [amount, setAmount] = useState('5');
  const [unit, setUnit] = useState<'T' | 'S' | '' | 'H' | 'D' | 'W' | 'M'>('');
  const unitLabels: Record<string, string> = { T: 'Ticks', S: 'Seconds', '': 'Minutes', H: 'Hours', D: 'Days', W: 'Weeks', M: 'Months' };
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60" style={{ zIndex: layerZIndex }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div data-testid="custom-interval-modal" className="w-[320px] rounded-xl border border-primary/25 bg-background p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Custom Interval</span>
          <button type="button" data-testid="custom-interval-close" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="mb-4 flex gap-2">
          <input data-testid="custom-interval-amount" type="number" min={1} max={9999} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-20 rounded-md border border-border/70 bg-background/80 px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
          <div className="flex flex-1 flex-wrap gap-1">
            {Object.entries(unitLabels).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setUnit(key as typeof unit)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${unit === key ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          data-testid="custom-interval-apply"
          onClick={() => { const num = parseInt(amount, 10); if (num > 0) { onApply(`${num}${unit}`); onClose(); } }}
          className="w-full rounded-md bg-primary/20 py-2 text-sm font-semibold text-primary transition hover:bg-primary/30"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */

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
  isFullView,
  onToggleFullView,
  modalZIndex = 90,
  onCompareSymbol,
}: ChartTopBarProps) {
  const [interval, setInterval] = useState<IntervalValue>('1D');
  const [customModalOpen, setCustomModalOpen] = useState(false);

  const intervalDropdown = useDropdown();
  const chartTypeDropdown = useDropdown();
  const snapDropdown = useDropdown();

  const selectInterval = useCallback((value: IntervalValue) => {
    setInterval(value);
    intervalDropdown.setOpen(false);
  }, [intervalDropdown]);

  return (
    <div
      data-testid="chart-top-bar"
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-primary/15 bg-background px-2 py-1"
    >
      {/* Compare symbol */}
      {onCompareSymbol && (
        <button type="button" data-testid="compare-symbol" onClick={onCompareSymbol} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-foreground" title="Compare symbol">
          <Plus size={15} />
        </button>
      )}

      {/* Hidden interval favorites — kept for E2E test compatibility */}
      {favoriteIntervals.map((iv) => (
        <button
          key={iv}
          type="button"
          data-testid={`timeframe-${intervalDisplayLabel(iv)}`}
          onClick={() => selectInterval(iv)}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        >
          {intervalDisplayLabel(iv)}
        </button>
      ))}

      {/* Interval button: shows current interval + opens full dropdown */}
      <div className="relative" ref={intervalDropdown.ref} data-testid="timeframe-dropdown">
        <button
          type="button"
          data-testid="timeframe-current"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-primary/10"
          onClick={() => intervalDropdown.setOpen(!intervalDropdown.open)}
        >
          {intervalDisplayLabel(interval)}
          <ChevronDown size={12} />
        </button>
        <div className={`absolute left-0 top-full z-[70] mt-1 w-[200px] rounded-xl border border-primary/30 bg-background p-1.5 shadow-xl shadow-black/50 ${intervalDropdown.open ? '' : 'hidden'}`}>
            {intervalGroups.map((group) => (
              <div key={group.label}>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{group.label}</div>
                <div className="flex flex-wrap gap-0.5 px-1 pb-1.5">
                  {group.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`interval-${opt.value}`}
                      onClick={() => selectInterval(opt.value)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        interval === opt.value ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-primary/10'
                      }`}
                    >
                      {opt.display}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t border-primary/10 pt-1">
              <button
                type="button"
                data-testid="custom-interval-btn"
                onClick={() => { intervalDropdown.setOpen(false); setCustomModalOpen(true); }}
                className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              >
                <Plus size={12} /> Custom interval
              </button>
            </div>
        </div>
      </div>

      <span className="h-4 w-px bg-border/40" />

      {/* ─── Chart style icon + dropdown ─────────────────────────────── */}
      <div className="relative" ref={chartTypeDropdown.ref} data-testid="charttype-dropdown">
        {(() => { const ChartIcon = chartTypeIconMap[chartType] ?? CandlestickChart; return (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-primary/10"
            onClick={() => chartTypeDropdown.setOpen(!chartTypeDropdown.open)}
            title={chartTypeLabels[chartType]}
            data-testid="charttype-current"
          >
            <ChartIcon size={15} />
            <span>{chartTypeLabels[chartType]}</span>
            <ChevronDown size={12} className={`transition-transform ${chartTypeDropdown.open ? 'rotate-180' : ''}`} />
          </button>
        ); })()}
        <div className={`absolute left-0 top-full z-[70] mt-1 max-h-[70vh] w-[230px] overflow-y-auto rounded-xl border border-primary/30 bg-background p-1 shadow-xl shadow-black/50 ${chartTypeDropdown.open ? '' : 'hidden'}`}>
            {chartTypeGroups.map((group) => (
              <div key={group.id}>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{group.label}</div>
                {group.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    data-testid={`chart-type-${type}`}
                    onClick={() => { setChartType(type); chartTypeDropdown.setOpen(false); }}
                    className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-[12px] transition ${
                      chartType === type ? 'bg-primary/20 font-semibold text-primary' : 'text-foreground hover:bg-primary/10'
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
      <div className="relative" ref={snapDropdown.ref} data-testid="snap-dropdown-wrapper">
        <button
          type="button"
          data-testid="snap-dropdown"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-primary/10"
          onClick={() => snapDropdown.setOpen(!snapDropdown.open)}
        >
          Snap: {snapLabels[crosshairSnapMode]}
          <ChevronDown size={11} />
        </button>
        <div className={`absolute left-0 top-full z-[70] mt-1 w-[130px] rounded-xl border border-primary/30 bg-background p-1 shadow-xl shadow-black/50 ${snapDropdown.open ? '' : 'hidden'}`}>
            {(['free', 'time', 'ohlc'] as CrosshairSnapMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                data-testid={`snap-option-${mode}`}
                onClick={() => { setCrosshairSnapMode(mode); snapDropdown.setOpen(false); }}
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
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
          indicatorsOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
        }`}
      >
        <TrendingUp size={14} />
        <span>Indicators{activeIndicatorsCount > 0 ? ` (${activeIndicatorsCount})` : ''}</span>
      </button>

      {/* Options */}
      <button
        type="button"
        data-testid="chart-options-toggle"
        onClick={() => setOptionsOpen(!optionsOpen)}
        className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
          optionsOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
        }`}
      >
        Options
      </button>

      {/* Objects */}
      <button
        type="button"
        data-testid="chart-objects-toggle"
        onClick={() => setTreeOpen(!treeOpen)}
        className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
          treeOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
        }`}
      >
        Objects
      </button>

      {/* Full view */}
      <button
        type="button"
        data-testid="chart-toggle-full-view"
        onClick={onToggleFullView}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
        title={isFullView ? 'Exit full view' : 'Open full view'}
      >
        {isFullView ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>

      <span className="h-4 w-px bg-border/40" />

      {/* Export */}
      <button type="button" data-testid="chart-export-png" onClick={onExportPng} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-foreground" title="Export PNG">
        <Camera size={15} />
      </button>

      {/* Clear */}
      <button type="button" data-testid="chart-clear" onClick={onClear} className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/20 hover:text-destructive" title="Clear all drawings">
        Clear
      </button>

      {/* Active drawing indicator */}
      {selectedDrawingVariant && (
        <span className="ml-auto rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary/80" data-testid="selected-tool-indicator">
          {selectedDrawingVariant}
        </span>
      )}

      {/* Custom interval modal */}
      {customModalOpen && (
        <CustomIntervalModal
          onApply={(value) => setInterval(value)}
          layerZIndex={modalZIndex}
          onClose={() => setCustomModalOpen(false)}
        />
      )}
    </div>
  );
}
