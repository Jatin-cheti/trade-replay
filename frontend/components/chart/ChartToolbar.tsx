import {
  ArrowRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  Circle,
  GitMerge,
  Layers,
  Layers3,
  Magnet,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  Minus,
  Move3d,
  PencilLine,
  Pin,
  Play,
  Plus,
  RectangleHorizontal,
  Ruler,
  SeparatorVertical,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Type,
  Waves,
  ZoomIn,
} from 'lucide-react';
import type { ChartType } from '@/services/chart/dataTransforms';
import { chartTypeGroups, chartTypeLabels } from '@/services/chart/dataTransforms';
import { toolGroups, type ToolCategory, type ToolState, type ToolVariant } from '@/services/tools/toolRegistry';
import { Redo2, Undo2 } from 'lucide-react';

type CrosshairSnapMode = 'free' | 'time' | 'ohlc';

const iconMap = {
  Move3d: Move3d,
  Waves: Waves,
  ArrowRight: ArrowRight,
  Layers: Layers,
  RectangleHorizontal: RectangleHorizontal,
  Circle: Circle,
  Play: Play,
  PencilLine: PencilLine,
  Type: Type,
  MessageSquare: MessageSquare,
  Tag: Tag,
  MessageCircle: MessageCircle,
  MessageSquareText: MessageSquareText,
  Pin: Pin,
  Sparkles: Sparkles,
  Minus: Minus,
  Plus: Plus,
  SeparatorVertical: SeparatorVertical,
  Layers3: Layers3,
  GitMerge: GitMerge,
  TrendingUp: TrendingUp,
  TrendingDown: TrendingDown,
  Ruler: Ruler,
  ZoomIn: ZoomIn,
  Camera: Camera,
} as const;

type ChartToolbarProps = {
  chartType: ChartType;
  setChartType: (value: ChartType) => void;
  toolState: ToolState;
  expandedCategory: ToolCategory | null;
  setExpandedCategory: (value: ToolCategory | null) => void;
  onVariant: (group: ToolCategory, variant: ToolVariant) => void;
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
  toolboxMinimized: boolean;
  setToolboxMinimized: (value: boolean) => void;
  toolbarCollapsed: boolean;
  setToolbarCollapsed: (value: boolean) => void;
  isMobile: boolean;
};

export default function ChartToolbar({
  chartType,
  setChartType,
  toolState,
  expandedCategory,
  setExpandedCategory,
  onVariant,
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
  toolboxMinimized,
  setToolboxMinimized,
  toolbarCollapsed,
  setToolbarCollapsed,
  isMobile,
}: ChartToolbarProps) {
  const quickTypes: ChartType[] = ['candlestick', 'line', 'area'];
  const allTypes = chartTypeGroups.flatMap((group) => group.types);
  const otherTypes = allTypes.filter((type) => !quickTypes.includes(type));

  return (
    <>
      {toolbarCollapsed && (
        <button
          type="button"
          data-testid="chart-toolbar-toggle"
          onClick={() => setToolbarCollapsed(false)}
          className={`absolute z-40 inline-flex items-center gap-1 rounded-lg border border-primary/25 bg-background/85 px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-xl hover:text-foreground ${isMobile ? 'right-3 top-3' : 'right-3 top-3'}`}
          title="Expand chart toolbar"
        >
          <ChevronLeft size={15} />
          Tools
        </button>
      )}

      <div className={`absolute z-30 rounded-xl border border-primary/25 bg-background/80 p-2.5 backdrop-blur-xl transition-all duration-200 ${isMobile ? `left-3 right-3 top-14 ${toolbarCollapsed ? '-translate-y-5 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}` : `${toolboxMinimized ? 'left-[184px]' : 'left-[288px]'} right-3 top-3 ${toolbarCollapsed ? 'translate-y-[-10px] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Chart Type</span>

        {quickTypes.map((type) => (
          <button
            key={type}
            type="button"
            data-testid={`chart-type-${type}`}
            onClick={() => setChartType(type)}
            className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${chartType === type ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`}
            title={chartTypeLabels[type]}
          >
            {chartTypeLabels[type]}
          </button>
        ))}

        <select
          value={otherTypes.includes(chartType) ? chartType : ''}
          onChange={(event) => setChartType(event.target.value as ChartType)}
          className="rounded-lg border border-primary/20 bg-background/70 px-3 py-2 text-[13px] font-semibold text-foreground outline-none"
          data-testid="chart-type-dropdown"
        >
          <option value="">More charts...</option>
          {otherTypes.map((type) => (
            <option key={type} value={type}>{chartTypeLabels[type]}</option>
          ))}
        </select>

        <button type="button" data-testid="chart-undo" onClick={onUndo} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:bg-primary/10 hover:text-foreground">
          <span className="inline-flex items-center gap-1.5"><Undo2 size={14} /> Undo</span>
        </button>
        <button type="button" data-testid="chart-redo" onClick={onRedo} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:bg-primary/10 hover:text-foreground">
          <span className="inline-flex items-center gap-1.5"><Redo2 size={14} /> Redo</span>
        </button>
        <button type="button" data-testid="chart-clear" onClick={onClear} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:bg-destructive/20 hover:text-destructive">Clear</button>
        <button type="button" data-testid="chart-export-png" onClick={onExportPng} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:bg-primary/10 hover:text-foreground">
          <span className="inline-flex items-center gap-1.5"><Camera size={14} /> Export PNG</span>
        </button>
        <button
          type="button"
          data-testid="indicators-button"
          onClick={() => setIndicatorsOpen(!indicatorsOpen)}
          className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${indicatorsOpen ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`}
        >
          Indicators{activeIndicatorsCount > 0 ? ` (${activeIndicatorsCount})` : ''}
        </button>
        <button type="button" onClick={() => setOptionsOpen(!optionsOpen)} className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${optionsOpen ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`}>Options</button>
          <button type="button" onClick={() => setTreeOpen(!treeOpen)} className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${treeOpen ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`}>Objects</button>
          <button
            type="button"
            data-testid="chart-toolbar-toggle"
            onClick={() => setToolbarCollapsed(true)}
            className="rounded-lg px-2 py-2 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
            title="Collapse chart toolbar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {isMobile && toolboxMinimized && (
        <button
          type="button"
          data-testid="chart-toolbox-toggle"
          onClick={() => setToolboxMinimized(false)}
          className="absolute left-3 top-3 z-40 inline-flex items-center gap-1 rounded-lg border border-primary/25 bg-background/85 px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-xl hover:text-foreground"
          title="Open toolbox"
        >
          <ChevronRight size={15} />
          Toolbox
        </button>
      )}

      <div className={`absolute left-3 top-3 z-40 rounded-xl border border-primary/25 bg-background/80 p-2.5 backdrop-blur-xl transition-all duration-200 ${isMobile ? `${toolboxMinimized ? '-translate-x-[110%] pointer-events-none opacity-0' : 'translate-x-0 opacity-100'} bottom-3 w-[268px] max-w-[80vw] overflow-y-auto` : `${toolboxMinimized ? 'w-[164px]' : 'max-h-[74vh] w-[268px] overflow-y-auto'}`}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Toolbox</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="tool-magnet"
              onClick={() => setMagnetMode(!magnetMode)}
              className={`rounded-md p-1.5 transition ${magnetMode ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`}
              title="Magnet mode"
            >
              <Magnet size={16} />
            </button>
            <select
              data-testid="chart-snap-mode"
              value={crosshairSnapMode}
              onChange={(event) => setCrosshairSnapMode(event.target.value as CrosshairSnapMode)}
              className="rounded-md border border-border/70 bg-background/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground outline-none hover:text-foreground"
              title="Crosshair snap mode"
            >
              <option value="free">Free</option>
              <option value="time">Time</option>
              <option value="ohlc">OHLC</option>
            </select>
            <button
              type="button"
              data-testid="tool-minimize"
              onClick={() => setToolboxMinimized(!toolboxMinimized)}
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
              title={toolboxMinimized ? 'Expand toolbox' : 'Minimize toolbox'}
            >
              {toolboxMinimized ? '+' : '−'}
            </button>
          </div>
        </div>

        {!toolboxMinimized && toolGroups.map((group) => {
          const expanded = expandedCategory === group.id;
          return (
            <div key={group.id} className="mb-1 rounded-lg border border-border/60 bg-background/50">
              <button
                type="button"
                data-testid={`tool-group-${group.id}`}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition ${expanded ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setExpandedCategory(expanded ? null : group.id)}
              >
                <span>{group.label}</span>
                <span>{expanded ? '−' : '+'}</span>
              </button>
              {expanded && (
                <div className="grid grid-cols-1 gap-1 px-2 pb-2">
                  {group.variants.map((variant) => {
                    const Icon = iconMap[variant.iconKey as keyof typeof iconMap] ?? Move3d;
                    const active = toolState.variant === variant.id;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        data-testid={`tool-${variant.id}`}
                        onClick={() => onVariant(group.id, variant.id)}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition ${active ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`}
                        title={variant.label}
                      >
                        <Icon size={16} />
                        <span>{variant.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
