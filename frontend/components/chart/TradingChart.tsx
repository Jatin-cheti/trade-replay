import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { CandleData } from '@/data/stockData';
import { toTimestamp, type ChartType } from '@/services/chart/dataTransforms';
import { getToolDefinition, type DrawPoint, type Drawing, type ToolCategory } from '@/services/tools/toolRegistry';
import { rgbFromHex } from '@/services/tools/toolOptions';
import { selectNearestDrawingId } from '@/services/tools/toolEngine';
import { useChart } from '@/hooks/useChart';
import { useTools } from '@/hooks/useTools';
import { useIsMobile } from '@/hooks/use-mobile';
import ChartCanvas from '@/components/chart/ChartCanvas';
import ChartToolbar from '@/components/chart/ChartToolbar';
import ToolOptionsPanel from '@/components/chart/ToolOptionsPanel';
import ObjectTreePanel from '@/components/chart/ObjectTreePanel';

interface TradingChartProps {
  data: CandleData[];
  visibleCount: number;
  symbol: string;
  mode?: 'simulation' | 'live';
  forceExpandedUi?: boolean;
}

function drawText(ctx: CanvasRenderingContext2D, drawing: Drawing, x: number, y: number, text: string) {
  const weight = drawing.options.bold ? '700' : '400';
  const italic = drawing.options.italic ? 'italic' : 'normal';
  ctx.font = `${italic} ${weight} ${drawing.options.textSize}px ${drawing.options.font}, sans-serif`;
  const pad = drawing.options.textPadding;

  if (drawing.options.textBackground) {
    const m = ctx.measureText(text);
    ctx.fillStyle = 'rgba(8, 18, 30, 0.75)';
    ctx.fillRect(x - pad, y - drawing.options.textSize - pad, m.width + pad * 2, drawing.options.textSize + pad * 1.5);
    if (drawing.options.textBorder) {
      ctx.strokeStyle = `rgba(${rgbFromHex(drawing.options.color)}, 0.8)`;
      ctx.strokeRect(x - pad, y - drawing.options.textSize - pad, m.width + pad * 2, drawing.options.textSize + pad * 1.5);
    }
  }

  ctx.fillStyle = `rgba(${rgbFromHex(drawing.options.color)}, ${drawing.options.opacity})`;
  ctx.strokeStyle = 'rgba(8, 20, 37, 0.95)';
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

export default function TradingChart({ data, visibleCount, symbol, mode = 'simulation', forceExpandedUi = false }: TradingChartProps) {
  const isMobile = useIsMobile();
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [expandedCategory, setExpandedCategory] = useState<ToolCategory | null>('trend');
  const [magnetMode, setMagnetMode] = useState(false);
  const [toolboxMinimized, setToolboxMinimized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [toolbarCollapsed, setToolbarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      return true;
    }
    try {
      return window.localStorage.getItem('chart-toolbar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 767px)').matches;
  });
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [dragAnchor, setDragAnchor] = useState<{ drawingId: string; anchorIndex: number } | null>(null);
  const [touchMode, setTouchMode] = useState<'idle' | 'pan' | 'axis-zoom' | 'scroll' | 'pinch'>('idle');
  const touchStartRef = useRef<{ x: number; y: number; zone: 'left' | 'center' | 'right' } | null>(null);
  const touchRafRef = useRef<number | null>(null);

  const {
    toolState,
    drawingsRef,
    draftRef,
    drawingActiveRef,
    setVariant,
    setOptions,
    startDraft,
    updateDraft,
    finalizeDraft,
    updateDrawing,
    removeDrawing,
    clearDrawings,
    undo,
    redo,
    resetForSymbol,
  } = useTools();

  const { chartContainerRef, overlayRef, chartRef, getActiveSeries, pointerToDataPoint, zoomToRange } = useChart(data, visibleCount, chartType);

  const applyTouchMode = useCallback((mode: 'idle' | 'pan' | 'axis-zoom' | 'scroll' | 'pinch') => {
    const chart = chartRef.current;
    if (!chart) return;

    if (touchRafRef.current != null) {
      window.cancelAnimationFrame(touchRafRef.current);
      touchRafRef.current = null;
    }

    touchRafRef.current = window.requestAnimationFrame(() => {
      touchRafRef.current = null;
      if (!chartRef.current) return;
      switch (mode) {
        case 'pan':
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: true, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
          break;
        case 'axis-zoom':
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: false, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
          break;
        case 'scroll':
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: false, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
          break;
        case 'pinch':
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: false, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
          break;
        default:
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: true, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
      }
    });
  }, [chartRef]);

  const activeDefinition = useMemo(() => getToolDefinition(toolState.variant), [toolState.variant]);
  const selectedDrawing = useMemo(
    () => drawingsRef.current.find((drawing) => drawing.id === selectedDrawingId) || null,
    [drawingsRef, selectedDrawingId, toolState.drawings]
  );

  const fallbackPoint = useCallback((): DrawPoint | null => {
    if (!data.length) return null;
    const idx = Math.max(0, Math.min(visibleCount - 1, data.length - 1));
    return { time: toTimestamp(data[idx].time), price: data[idx].close };
  }, [data, visibleCount]);

  const rafRef = useRef<number | null>(null);
  const renderOverlay = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const overlay = overlayRef.current;
      const series = getActiveSeries();
      if (!overlay || !series) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.clientWidth, overlay.clientHeight);

      const toXY = (point: DrawPoint) => {
        const x = chartRef.current?.timeScale().timeToCoordinate(point.time);
        const y = series.priceToCoordinate(point.price);
        if (x == null || y == null) return null;
        return { x, y };
      };

      const drawTool = (drawing: Drawing, draft = false) => {
        if (!drawing.visible || !drawing.options.visible || !drawing.anchors.length) return;
        const def = getToolDefinition(drawing.variant);
        if (!def) return;

        const points = drawing.anchors.map(toXY).filter(Boolean) as Array<{ x: number; y: number }>;
        if (!points.length) return;

        ctx.strokeStyle = `rgba(${rgbFromHex(drawing.options.color)}, ${drawing.options.opacity})`;
        ctx.fillStyle = `rgba(${rgbFromHex(drawing.options.color)}, 0.12)`;
        ctx.lineWidth = drawing.options.thickness;
        ctx.setLineDash(draft ? [6, 4] : drawing.options.style === 'dashed' ? [6, 4] : drawing.options.style === 'dotted' ? [2, 4] : []);

        if (def.family === 'text') {
          const text = drawing.text || drawing.variant;
          drawText(ctx, drawing, points[0].x + 4, points[0].y - 4, text);
        } else if (def.family === 'shape') {
          const p1 = points[0];
          const p2 = points[1] || p1;
          if (def.behaviors?.shapeKind === 'circle') {
            const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else if (def.behaviors?.shapeKind === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(p1.x, p2.y);
            ctx.lineTo((p1.x + p2.x) / 2, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else {
            const x = Math.min(p1.x, p2.x);
            const y = Math.min(p1.y, p2.y);
            const w = Math.abs(p2.x - p1.x);
            const h = Math.abs(p2.y - p1.y);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
          }
        } else if (def.family === 'fib') {
          const p1 = points[0];
          const p2 = points[1] || p1;
          const levels = def.behaviors?.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 1];
          for (const level of levels) {
            const y = p1.y + (p2.y - p1.y) * level;
            ctx.beginPath();
            ctx.moveTo(Math.min(p1.x, p2.x), y);
            ctx.lineTo(Math.max(p1.x, p2.x), y);
            ctx.stroke();
            if (drawing.options.priceLabel) drawText(ctx, drawing, Math.max(p1.x, p2.x) + 4, y + 2, `${(level * 100).toFixed(1)}%`);
          }
        } else {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
          if (drawing.options.extendLeft && points.length >= 2) {
            const p1 = points[0];
            const p2 = points[1];
            const m = (p2.y - p1.y) / ((p2.x - p1.x) || 1);
            ctx.moveTo(0, p1.y - m * p1.x);
            ctx.lineTo(p1.x, p1.y);
          }
          if (drawing.options.extendRight && points.length >= 2) {
            const p1 = points[points.length - 2];
            const p2 = points[points.length - 1];
            const m = (p2.y - p1.y) / ((p2.x - p1.x) || 1);
            const w = overlay.clientWidth;
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(w, p2.y + m * (w - p2.x));
          }
          ctx.stroke();
        }

        if (selectedDrawingId === drawing.id) {
          for (const anchor of points) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };

      drawingsRef.current.forEach((drawing) => drawTool(drawing));
      if (draftRef.current) drawTool(draftRef.current, true);
    });
  }, [chartRef, drawingsRef, draftRef, getActiveSeries, overlayRef, selectedDrawingId]);

  useEffect(() => {
    renderOverlay();
  }, [renderOverlay, toolState.drawings, chartType, selectedDrawingId]);

  useEffect(() => {
    resetForSymbol();
    setSelectedDrawingId(null);
  }, [resetForSymbol, symbol]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDrawingId) {
        const d = drawingsRef.current.find((item) => item.id === selectedDrawingId);
        if (d?.locked) return;
        removeDrawing(selectedDrawingId);
        setSelectedDrawingId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawingsRef, removeDrawing, selectedDrawingId]);

  useEffect(() => {
    try {
      window.localStorage.setItem('chart-toolbar-collapsed', toolbarCollapsed ? '1' : '0');
    } catch {
      // Ignore storage errors in restricted environments.
    }
  }, [toolbarCollapsed]);

  useEffect(() => {
    if (!isMobile) {
      setToolboxMinimized(false);
      setTreeOpen(true);
      applyTouchMode('idle');
      setTouchMode('idle');
      return;
    }

    setToolboxMinimized(true);
    setTreeOpen(false);
    setToolbarCollapsed(true);
    applyTouchMode('scroll');
    setTouchMode('scroll');
  }, [applyTouchMode, isMobile]);

  useEffect(() => {
    if (!forceExpandedUi || isMobile) return;
    setToolboxMinimized(false);
    setToolbarCollapsed(false);
    setTreeOpen(true);
    setExpandedCategory((current) => current ?? 'trend');
  }, [forceExpandedUi, isMobile]);

  useEffect(() => {
    return () => {
      if (touchRafRef.current != null) {
        window.cancelAnimationFrame(touchRafRef.current);
      }
    };
  }, []);

  const detectTouchZone = useCallback((clientX: number, width: number): 'left' | 'center' | 'right' => {
    if (clientX > width * 0.85) return 'right';
    if (clientX < width * 0.65) return 'left';
    return 'center';
  }, []);

  const onChartTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if (event.touches.length >= 2) {
      setTouchMode('pinch');
      applyTouchMode('pinch');
      touchStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = touch.clientX - bounds.left;
    const zone = detectTouchZone(localX, bounds.width);
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, zone };
    setTouchMode(zone === 'center' ? 'scroll' : 'idle');
    applyTouchMode(zone === 'center' ? 'scroll' : 'idle');
  };

  const onChartTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if (event.touches.length >= 2) {
      if (touchMode !== 'pinch') {
        setTouchMode('pinch');
        applyTouchMode('pinch');
      }
      return;
    }

    const start = touchStartRef.current;
    if (!start) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (start.zone === 'center') {
      if (touchMode !== 'scroll') {
        setTouchMode('scroll');
        applyTouchMode('scroll');
      }
      return;
    }

    if (start.zone === 'right') {
      const shouldZoom = Math.abs(dy) >= Math.abs(dx);
      const next = shouldZoom ? 'axis-zoom' : 'scroll';
      if (touchMode !== next) {
        setTouchMode(next);
        applyTouchMode(next);
      }
      if (shouldZoom) {
        event.preventDefault();
      }
      return;
    }

    const shouldPan = Math.abs(dx) > Math.abs(dy);
    const next = shouldPan ? 'pan' : 'scroll';
    if (touchMode !== next) {
      setTouchMode(next);
      applyTouchMode(next);
    }
    if (shouldPan) {
      event.preventDefault();
    }
  };

  const onChartTouchEnd = () => {
    if (!isMobile) return;
    touchStartRef.current = null;
    setTouchMode('scroll');
    applyTouchMode('scroll');
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointerToDataPoint(event.clientX, event.clientY, magnetMode) || fallbackPoint();
    if (!point) return;

    if (toolState.variant === 'none') {
      const selected = selectNearestDrawingId(drawingsRef.current, point);
      setSelectedDrawingId(selected);
      if (selected) {
        const drawing = drawingsRef.current.find((item) => item.id === selected);
        if (drawing && !drawing.locked) {
          const idx = drawing.anchors.findIndex((a) => Math.abs(a.time - point.time) < 86400 && Math.abs(a.price - point.price) < Math.max(0.2, point.price * 0.02));
          if (idx >= 0) setDragAnchor({ drawingId: selected, anchorIndex: idx });
        }
      }
      overlayRef.current?.setPointerCapture(event.pointerId);
      renderOverlay();
      return;
    }

    const text = activeDefinition?.capabilities.supportsText ? promptForVariantText(toolState.variant as Exclude<typeof toolState.variant, 'none'>) : undefined;
    const result = startDraft(point, text);
    if (result.kind === 'finalized') {
      const d = drawingsRef.current[drawingsRef.current.length - 1];
      if (d) setSelectedDrawingId(d.id);
      renderOverlay();
    }
    overlayRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointerToDataPoint(event.clientX, event.clientY, magnetMode) || fallbackPoint();
    if (!point) return;

    if (dragAnchor) {
      updateDrawing(dragAnchor.drawingId, (drawing) => {
        const next = [...drawing.anchors];
        next[dragAnchor.anchorIndex] = point;
        return { ...drawing, anchors: next };
      });
      renderOverlay();
      return;
    }

    if (!drawingActiveRef.current) return;
    updateDraft(point);
    renderOverlay();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (overlayRef.current?.hasPointerCapture(event.pointerId)) overlayRef.current.releasePointerCapture(event.pointerId);
    if (dragAnchor) {
      setDragAnchor(null);
      return;
    }

    const committed = finalizeDraft();
    if (toolState.variant === 'zoom' && committed?.anchors[1]) {
      zoomToRange(committed.anchors[0].time, committed.anchors[1].time);
      removeDrawing(committed.id);
    } else if (committed) {
      setSelectedDrawingId(committed.id);
    }
    renderOverlay();
  };

  return (
    <div className="relative flex h-full w-full min-h-[340px] flex-col">
      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-xl"
        onTouchStart={onChartTouchStart}
        onTouchMove={onChartTouchMove}
        onTouchEnd={onChartTouchEnd}
        onTouchCancel={onChartTouchEnd}
      >
        <div className="chart-wrapper h-full w-full touch-pan-y">
          <ChartCanvas chartContainerRef={chartContainerRef} overlayRef={overlayRef} activeVariant={toolState.variant} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onContextMenu={(e) => e.preventDefault()} />
        </div>

        <ChartToolbar chartType={chartType} setChartType={setChartType} toolState={toolState} expandedCategory={expandedCategory} setExpandedCategory={setExpandedCategory} onVariant={(group, variant) => setVariant(variant, group)} magnetMode={magnetMode} setMagnetMode={setMagnetMode} onUndo={undo} onRedo={redo} onClear={clearDrawings} optionsOpen={optionsOpen} setOptionsOpen={setOptionsOpen} treeOpen={treeOpen} setTreeOpen={setTreeOpen} toolboxMinimized={toolboxMinimized} setToolboxMinimized={setToolboxMinimized} toolbarCollapsed={toolbarCollapsed} setToolbarCollapsed={setToolbarCollapsed} isMobile={isMobile} />

        <ToolOptionsPanel open={optionsOpen} options={toolState.options} optionsSchema={activeDefinition?.optionsSchema || []} onChange={setOptions} />

        {selectedDrawing && <div className="absolute right-3 top-3 z-40 rounded-lg border border-primary/25 bg-background/90 px-2 py-1 text-[11px] text-muted-foreground">selected: {selectedDrawing.variant}</div>}
      </div>

      <div className="mt-2">
        <ObjectTreePanel open={treeOpen} isMobile={isMobile} drawings={toolState.drawings} selectedDrawingId={selectedDrawingId} onSelect={setSelectedDrawingId} onToggleVisible={(id) => updateDrawing(id, (d) => ({ ...d, visible: !d.visible, options: { ...d.options, visible: !d.options.visible } }))} onToggleLocked={(id) => updateDrawing(id, (d) => ({ ...d, locked: !d.locked, options: { ...d.options, locked: !d.options.locked } }))} onDelete={removeDrawing} onTogglePanel={() => setTreeOpen((prev) => !prev)} />
      </div>

      <div data-testid="drawing-badge" className="mt-2 rounded-lg border border-primary/20 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur-xl">
        {symbol} · {mode} · {chartType} · {toolState.drawings.length} drawing{toolState.drawings.length === 1 ? '' : 's'} · tool: {toolState.variant} · magnet: {magnetMode ? 'on' : 'off'}
      </div>
    </div>
  );
}

function promptForVariantText(variant: Exclude<import('@/services/tools/toolRegistry').ToolVariant, 'none'>) {
  if (variant === 'emoji') return window.prompt('Emoji', '🚀') || '🚀';
  if (variant === 'priceLabel') return '';
  return window.prompt('Text', 'Label') || 'Label';
}
