import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlignHorizontalSpaceAround,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Box,
  Circle,
  Clock3,
  CornerRightUp,
  Crosshair,
  Eraser,
  Eye,
  EyeOff,
  Fan,
  Flag,
  GitFork,
  GitMerge,
  Info,
  Layers,
  Layers3,
  Lock,
  Magnet,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  Minus,
  MoreHorizontal,
  Mountain,
  MousePointer,
  MousePointer2,
  Move3d,
  MoveHorizontal,
  MoveRight,
  Orbit,
  PencilLine,
  Pin,
  Play,
  RectangleHorizontal,
  Repeat,
  Ruler,
  SeparatorVertical,
  Sparkles,
  Square,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Triangle,
  Type,
  Unlink,
  Waves,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toolGroups, type CursorMode, type ToolCategory, type ToolGroup, type ToolGroupVariant, type ToolState, type ToolVariant } from '@/services/tools/toolRegistry';
import IconToolPanel, { type IconPresetSelection } from '@/components/chart/IconToolPanel';

/* ── Icon map ───────────────────────────────────────────────── */
const railIconMap: Record<string, LucideIcon> = {
  Activity, AlignHorizontalSpaceAround, ArrowDown, ArrowRight, ArrowUp, Box, Circle,
  Clock3, CornerRightUp, Crosshair, Eraser, Eye, EyeOff, Fan, Flag, GitFork, GitMerge, Info,
  Layers, Layers3, Lock, Magnet, MessageCircle, MessageSquare, MessageSquareText, Minus, Mountain,
  MousePointer, MousePointer2, Move3d, MoveHorizontal, MoveRight, Orbit, PencilLine,
  Pin, Play, RectangleHorizontal, Repeat, Ruler, SeparatorVertical, Sparkles, Square, Tag,
  Trash2, TrendingDown, TrendingUp, Triangle, Type, Unlink, Waves, ZoomIn, ZoomOut,
};

/* ── Cursor items (special menu) ────────────────────────────── */
const cursorItems: Array<{ id: CursorMode; label: string; iconKey: string }> = [
  { id: 'cross', label: 'Cross', iconKey: 'Crosshair' },
  { id: 'dot', label: 'Dot', iconKey: 'Circle' },
  { id: 'arrow', label: 'Arrow', iconKey: 'MousePointer' },
  { id: 'demo', label: 'Demonstration', iconKey: 'Play' },
  { id: 'eraser', label: 'Eraser', iconKey: 'Eraser' },
];

const requiredTestIdByVariant: Partial<Record<ToolVariant, string>> = {
  trend: 'tool-trendline',
  ray: 'tool-ray',
  infoLine: 'tool-info-line',
  extendedLine: 'tool-extended-line',
  trendAngle: 'tool-trend-angle',
  hline: 'tool-horizontal-line',
  horizontalRay: 'tool-horizontal-ray',
  vline: 'tool-vertical-line',
  crossLine: 'tool-cross-line',
  channel: 'tool-parallel-channel',
  regressionTrend: 'tool-regression-trend',
  flatTopBottom: 'tool-flat-top-bottom',
  disjointChannel: 'tool-disjoint-channel',
  pitchfork: 'tool-pitchfork',
  schiffPitchfork: 'tool-schiff-pitchfork',
  modifiedSchiffPitchfork: 'tool-modified-schiff-pitchfork',
  insidePitchfork: 'tool-inside-pitchfork',
  fibRetracement: 'fib-retracement',
  fibExtension: 'fib-extension',
  fibChannel: 'fib-channel',
  fibTimeZone: 'fib-time-zone',
  fibSpeedResistFan: 'fib-speed-resistance-fan',
  fibTrendTime: 'fib-trend-time',
  fibCircles: 'fib-circles',
  fibSpiral: 'fib-spiral',
  fibSpeedResistArcs: 'fib-speed-resistance-arcs',
  fibWedge: 'fib-wedge',
  pitchfan: 'pitchfan',
  gannBox: 'gann-box',
  gannSquareFixed: 'gann-square-fixed',
  gannSquare: 'gann-square',
  gannFan: 'gann-fan',
  /* Text & annotation tools */
  plainText: 'tool-plain-text',
  anchoredText: 'tool-anchored-text',
  note: 'tool-note',
  priceNote: 'tool-price-note',
  pin: 'tool-pin',
  table: 'tool-table',
  callout: 'tool-callout',
  comment: 'tool-comment',
  priceLabel: 'tool-price-label',
  signpost: 'tool-signpost',
  flagMark: 'tool-flag-mark',
  image: 'tool-image',
  post: 'tool-post',
  idea: 'tool-idea',
};

/* ── Props ──────────────────────────────────────────────────── */
type ToolRailProps = {
  toolState: ToolState;
  expandedCategory: ToolCategory | null;
  setExpandedCategory: (value: ToolCategory | null) => void;
  onVariant: (group: ToolCategory, variant: ToolVariant) => void;
  selectedIconPreset: IconPresetSelection | null;
  onIconPresetSelect: (preset: IconPresetSelection) => void;
  cursorMode: CursorMode;
  onCursorModeSelect: (mode: CursorMode) => void;
  valuesTooltip: boolean;
  setValuesTooltip: (value: boolean) => void;
  isMobile: boolean;
  /* Standalone rail tools */
  magnetMode: boolean;
  onToggleMagnet: () => void;
  keepDrawing: boolean;
  onToggleKeepDrawing: () => void;
  lockAll: boolean;
  onToggleLockAll: () => void;
  hideAll: boolean;
  onToggleHideAll: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onMeasure: () => void;
  onDelete: () => void;
  portalZIndex?: number;
};

export default function ToolRail({
  toolState,
  expandedCategory,
  setExpandedCategory,
  onVariant,
  selectedIconPreset,
  onIconPresetSelect,
  cursorMode,
  onCursorModeSelect,
  valuesTooltip,
  setValuesTooltip,
  isMobile,
  magnetMode,
  onToggleMagnet,
  keepDrawing,
  onToggleKeepDrawing,
  lockAll,
  onToggleLockAll,
  hideAll,
  onToggleHideAll,
  onZoomIn,
  onZoomOut,
  onMeasure,
  onDelete,
  portalZIndex = 60,
}: ToolRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
  const [submenuStyle, setSubmenuStyle] = useState<React.CSSProperties>({});

  const activeGroup = toolGroups.find((g) => g.id === expandedCategory) ?? null;
  const railGroups = toolGroups;
  const isIconGroup = expandedCategory === 'icon';
  const iconDefaultTab = toolState.variant === 'sticker' ? 'sticker' : toolState.variant === 'iconTool' ? 'icon' : 'emoji';
  const handlePopoverWheelCapture = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const scrollSelector = '[data-testid="toolrail-scroll"], [data-testid="icon-panel-scroll"]';
    const scroller = (target.closest(scrollSelector) as HTMLElement | null) ?? (submenuRef.current?.querySelector(scrollSelector) as HTMLElement | null);

    if (scroller && scroller.scrollHeight > scroller.clientHeight) {
      scroller.scrollTop += e.deltaY;
      e.preventDefault();
    }

    e.stopPropagation();
  }, []);

  /* ── Position submenu anchored to rail button ─────────────── */
  const positionSubmenu = useCallback(() => {
    if (!expandedCategory || !railRef.current) return;
    const btn = railRef.current.querySelector(`[data-rail-group="${expandedCategory}"]`) as HTMLElement | null;
    if (!btn) return;
    const btnRect = btn.getBoundingClientRect();
    const railRect = railRef.current.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const menuW = submenuRef.current?.offsetWidth ?? (expandedCategory === 'icon' ? 344 : 260);
    const menuH = submenuRef.current?.offsetHeight ?? (expandedCategory === 'icon' ? 540 : 280);
    const maxMenuH = expandedCategory === 'icon' ? 540 : 420;
    const cappedMenuH = Math.min(menuH, viewH - 16, maxMenuH);

    // Anchor vertically to the clicked button
    let top = btnRect.top;
    // Anchor horizontally to the right of the rail
    let left = railRect.right + 2;

    // If not enough space to the right, open to the left of the rail
    if (left + menuW > viewW - 8) {
      left = railRect.left - menuW - 2;
    }

    // Clamp within viewport
    if (top + cappedMenuH > viewH - 8) top = Math.max(8, viewH - cappedMenuH - 8);
    if (top < 8) top = 8;
    if (left < 8) left = 8;
    if (left + menuW > viewW - 8) left = Math.max(8, viewW - menuW - 8);

    setSubmenuStyle({
      position: 'fixed',
      top,
      left,
      maxHeight: cappedMenuH,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      zIndex: portalZIndex,
    });
  }, [expandedCategory, portalZIndex]);

  useEffect(() => {
    positionSubmenu();
    const throttledPosition = () => {
      if (rafId.current) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        positionSubmenu();
      });
    };
    const onScroll = (e: Event) => {
      // Keep the popover open while users pan/scroll the chart; just re-anchor it.
      if (submenuRef.current?.contains(e.target as Node)) return;
      throttledPosition();
    };
    window.addEventListener('resize', throttledPosition);
    window.addEventListener('scroll', onScroll, true);

    let ro: ResizeObserver | undefined;
    if (railRef.current) {
      ro = new ResizeObserver(throttledPosition);
      ro.observe(railRef.current);
    }

    return () => {
      window.removeEventListener('resize', throttledPosition);
      window.removeEventListener('scroll', onScroll, true);
      ro?.disconnect();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [positionSubmenu]);

  /* ── Close on outside click or ESC ────────────────────────── */
  useEffect(() => {
    if (!expandedCategory) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (railRef.current?.contains(target)) return;
      if (submenuRef.current?.contains(target)) return;
      setExpandedCategory(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedCategory(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expandedCategory, setExpandedCategory]);

  const hasActiveVariantInGroup = (groupId: ToolCategory) =>
    toolGroups.find((g) => g.id === groupId)?.variants.some((v) => v.id === toolState.variant) ?? false;

  if (isMobile) return null;

  /* ── Render a tool variant button ─────────────────────────── */
  const renderVariant = (variant: ToolGroupVariant, group: ToolGroup) => {
    const Icon = railIconMap[variant.iconKey] ?? Move3d;
    const active = toolState.variant === variant.id;
    const disabled = !variant.implemented;
    const legacyTestId = `tool-${variant.id}`;
    const requiredTestId = requiredTestIdByVariant[variant.id];
    const testId = requiredTestId ?? legacyTestId;
    return (
      <button
        key={variant.id}
        type="button"
        data-testid={testId}
        data-legacy-testid={legacyTestId}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          onVariant(group.id, variant.id);
          setExpandedCategory(null);
        }}
        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition ${
          disabled
            ? 'cursor-default text-muted-foreground/40'
            : active
              ? 'bg-primary/25 text-primary'
              : 'text-foreground/80 hover:bg-primary/10 hover:text-foreground'
        }`}
        title={disabled ? `${variant.label} — Coming soon` : variant.label}
      >
        <Icon size={16} className={disabled ? 'opacity-40' : ''} />
        <span className="flex-1 text-left">{variant.label}</span>
        {requiredTestId && requiredTestId !== legacyTestId ? <span className="sr-only" data-testid={legacyTestId} /> : null}
        {disabled && <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Soon</span>}
      </button>
    );
  };

  /* ── Build submenu content ────────────────────────────────── */
  const renderSubmenuContent = () => {
    if (!activeGroup) return null;

    const sections = new Map<string, ToolGroupVariant[]>();
    let hasSubSections = false;
    for (const v of activeGroup.variants) {
      const sec = v.subSection ?? '';
      if (sec) hasSubSections = true;
      const arr = sections.get(sec) ?? [];
      arr.push(v);
      sections.set(sec, arr);
    }

    if (!hasSubSections) {
      return activeGroup.variants.map((v) => renderVariant(v, activeGroup));
    }

    const entries = Array.from(sections.entries());
    return entries.map(([sectionName, variants], idx) => (
      <div key={sectionName || idx}>
        {sectionName && (
          <div className={`px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 ${idx > 0 ? 'mt-1.5 border-t border-primary/10 pt-2.5' : ''}`}>
            {sectionName}
          </div>
        )}
        {variants.map((v) => renderVariant(v, activeGroup))}
      </div>
    ));
  };

  /* ── Cursor menu ──────────────────────────────────────────── */
  const renderCursorMenu = () => (
    <div>
      {cursorItems.map((item) => {
        const Icon = railIconMap[item.iconKey] ?? Crosshair;
        const active = cursorMode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`cursor-${item.id}`}
            onClick={() => {
              onCursorModeSelect(item.id);
              if (item.id !== 'eraser') setExpandedCategory(null);
            }}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition ${
              active
                ? 'bg-primary/25 text-primary'
                : 'text-foreground/80 hover:bg-primary/10 hover:text-foreground'
            }`}
          >
            <Icon size={16} />
            <span>{item.label}</span>
          </button>
        );
      })}
      <div className="mt-1.5 border-t border-primary/10 px-2.5 py-2">
        <label className="flex cursor-pointer items-center justify-between text-[12px] text-foreground/80" data-testid="cursor-values-tooltip-toggle">
          <span>Values tooltip on long press</span>
          <button
            type="button"
            role="switch"
            aria-checked={valuesTooltip}
            onClick={() => setValuesTooltip(!valuesTooltip)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${valuesTooltip ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${valuesTooltip ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
          </button>
        </label>
      </div>
    </div>
  );

  const renderMoreToolsMenu = () => null;

  return (
    <>
      {/* Rail */}
      <div
        ref={railRef}
        data-testid="tool-rail"
        className="flex w-[44px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-primary/15 bg-background/60 py-1.5 backdrop-blur-xl"
      >
        {railGroups.map((group) => {
          const Icon = railIconMap[group.railIcon] ?? Move3d;
          const isOpen = expandedCategory === group.id;
          const isActive = group.id === 'cursor' ? false : hasActiveVariantInGroup(group.id);
          return (
            <button
              key={group.id}
              type="button"
              data-testid={`rail-${group.id}`}
              data-toolrail-button={group.id}
              data-rail-group={group.id}
              onClick={() => setExpandedCategory(isOpen ? null : group.id)}
              className={`flex h-[36px] w-[36px] items-center justify-center rounded-md transition ${
                isOpen
                  ? 'bg-primary/20 text-primary'
                  : isActive
                    ? 'bg-primary/10 text-primary/80'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
              }`}
              title={group.label}
            >
              <Icon size={18} />
              <span className="sr-only" data-testid={`toolrail-button-${group.id}`} />
            </button>
          );
        })}

        {/* ── Standalone action tools ─────────────────────────── */}
        <div className="my-1 h-px w-7 bg-border/40" />

        <button type="button" data-testid="rail-measure" onClick={onMeasure} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-foreground" title="Measure"><Ruler size={18} /></button>
        <button type="button" data-testid="rail-zoom-in" onClick={onZoomIn} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-foreground" title="Zoom in"><ZoomIn size={18} /></button>
        <button type="button" data-testid="rail-zoom-out" onClick={onZoomOut} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-foreground" title="Zoom out"><ZoomOut size={18} /></button>
        <button type="button" data-testid="rail-magnet" onClick={onToggleMagnet} className={`flex h-[36px] w-[36px] items-center justify-center rounded-md transition ${magnetMode ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`} title="Magnet"><Magnet size={18} /></button>
        <button type="button" data-testid="rail-keep-drawing" onClick={onToggleKeepDrawing} className={`flex h-[36px] w-[36px] items-center justify-center rounded-md transition ${keepDrawing ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`} title="Keep drawing"><Repeat size={18} /></button>
        <button type="button" data-testid="rail-lock-drawings" onClick={onToggleLockAll} className={`flex h-[36px] w-[36px] items-center justify-center rounded-md transition ${lockAll ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`} title="Lock all drawings"><Lock size={18} /></button>
        <button type="button" data-testid="rail-hide-objects" onClick={onToggleHideAll} className={`flex h-[36px] w-[36px] items-center justify-center rounded-md transition ${hideAll ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`} title="Hide all drawings">{hideAll ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        <button type="button" data-testid="rail-delete" onClick={onDelete} className="flex h-[36px] w-[36px] items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/20 hover:text-destructive" title="Delete objects"><Trash2 size={18} /></button>
      </div>

      {/* Floating popover anchored to rail icon — portal to body to escape containing block from backdrop-filter */}
      {expandedCategory && expandedCategory !== 'system' && createPortal(
        <div
          ref={submenuRef}
          data-testid="toolrail-popover"
          style={submenuStyle}
          onWheelCapture={handlePopoverWheelCapture}
          className={isIconGroup ? 'w-[344px] max-w-[calc(100vw-20px)] overflow-hidden rounded-xl border border-primary/25 bg-background/95 p-1.5 shadow-xl shadow-black/40 backdrop-blur-xl' : 'min-w-[220px] max-w-[280px] overflow-hidden rounded-xl border border-primary/25 bg-background/95 p-1.5 shadow-xl shadow-black/40 backdrop-blur-xl'}
        >
          <div data-testid={expandedCategory === 'cursor' ? 'menu-cursor' : `menu-${expandedCategory}`} className="mb-1 shrink-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            {expandedCategory === 'cursor' ? 'Cursor' : activeGroup?.label ?? ''}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {expandedCategory === 'cursor' ? (
              <div data-testid="toolrail-scroll" className="min-h-0 flex-1 overflow-y-scroll">{renderCursorMenu()}</div>
            ) : isIconGroup ? (
              <IconToolPanel
                defaultTab={iconDefaultTab}
                selectedPreset={selectedIconPreset}
                onSelectPreset={(preset) => {
                  if (toolState.variant !== preset.variant) {
                    onVariant('icon', preset.variant);
                  }
                  onIconPresetSelect(preset);
                  setExpandedCategory(null);
                }}
              />
            ) : (
              <div data-testid="toolrail-scroll" className="min-h-0 flex-1 overflow-y-scroll">{renderSubmenuContent()}</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
