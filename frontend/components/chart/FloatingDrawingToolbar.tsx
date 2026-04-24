/**
 * FloatingDrawingToolbar — TradingView-parity selection toolbar.
 *
 * Displayed when a drawing is selected; rendered in a React portal so that
 * chart container's `backdrop-filter` does not clip it, and so it floats
 * above the chart overlay canvas.
 *
 * Actions:
 *   • color swatch  → cycles through TV palette
 *   • thickness     → cycles 1 / 2 / 3 / 4 px
 *   • style         → cycles solid / dashed / dotted
 *   • add text      → attaches an anchoredText drawing at line midpoint
 *   • lock toggle
 *   • visible toggle
 *   • duplicate
 *   • delete
 *   • settings      → opens full options panel
 */
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Drawing } from '@/services/tools/toolRegistry';

// TradingView default line palette
const COLOR_PALETTE = [
  '#2962ff',
  '#2196f3',
  '#00bcd4',
  '#00e676',
  '#ffd600',
  '#ff9100',
  '#f23645',
  '#e91e63',
  '#9c27b0',
  '#ffffff',
  '#9e9e9e',
  '#000000',
];

const THICKNESS_CYCLE = [1, 2, 3, 4];
const STYLE_CYCLE: Array<'solid' | 'dashed' | 'dotted'> = ['solid', 'dashed', 'dotted'];

export type FloatingToolbarAnchor = {
  // Client-space rect of the selected drawing's tightest bbox.
  top: number;
  left: number;
  right: number;
  bottom: number;
} | null;

export type FloatingDrawingToolbarProps = {
  drawing: Drawing | null;
  anchor: FloatingToolbarAnchor;
  zIndex: number;
  onChangeColor: (color: string) => void;
  onChangeThickness: (thickness: number) => void;
  onChangeStyle: (style: 'solid' | 'dashed' | 'dotted') => void;
  onToggleLock: () => void;
  onToggleVisible: () => void;
  onAddText: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenSettings: () => void;
};

export default function FloatingDrawingToolbar(props: FloatingDrawingToolbarProps) {
  const {
    drawing,
    anchor,
    zIndex,
    onChangeColor,
    onChangeThickness,
    onChangeStyle,
    onToggleLock,
    onToggleVisible,
    onAddText,
    onDuplicate,
    onDelete,
    onOpenSettings,
  } = props;

  const [openPanel, setOpenPanel] = useState<'none' | 'color' | 'thickness' | 'style'>('none');

  // Close dropdowns when selection changes or toolbar unmounts.
  useEffect(() => {
    setOpenPanel('none');
  }, [drawing?.id]);

  // Close dropdowns on outside click.
  useEffect(() => {
    if (openPanel === 'none') return;
    const onGlobalMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-floating-toolbar]')) setOpenPanel('none');
    };
    window.addEventListener('mousedown', onGlobalMouseDown, true);
    return () => window.removeEventListener('mousedown', onGlobalMouseDown, true);
  }, [openPanel]);

  const position = useMemo(() => {
    if (!anchor) return null;
    // Center horizontally above bbox; if too close to top of viewport, flip below.
    const toolbarHeight = 40;
    const toolbarWidth = 320;
    const margin = 8;
    const centerX = (anchor.left + anchor.right) / 2;
    let left = Math.max(margin, Math.min(window.innerWidth - toolbarWidth - margin, centerX - toolbarWidth / 2));
    let top = anchor.top - toolbarHeight - margin;
    if (top < margin) top = anchor.bottom + margin;
    return { top, left };
  }, [anchor]);

  // Re-render when window resizes to keep toolbar pinned.
  const [, force] = useState(0);
  useLayoutEffect(() => {
    const onResize = () => force((n) => (n + 1) % 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!drawing || !anchor || !position) return null;

  const opts = drawing.options;
  const isLocked = Boolean(drawing.locked || opts.locked);
  const isVisible = drawing.visible !== false && opts.visible !== false;

  const toolbar = (
    <div
      data-floating-toolbar
      data-testid="floating-drawing-toolbar"
      data-drawing-id={drawing.id}
      role="toolbar"
      aria-label="Drawing toolbar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex,
      }}
      className="flex items-center gap-1 rounded-md border border-primary/30 bg-background/95 px-2 py-1 shadow-xl backdrop-blur-md"
    >
      {/* Color swatch with popover */}
      <div className="relative">
        <button
          type="button"
          data-testid="floating-toolbar-color"
          title="Color"
          onClick={() => setOpenPanel((p) => (p === 'color' ? 'none' : 'color'))}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-primary/10"
        >
          <span
            className="h-4 w-4 rounded-sm border border-white/40"
            style={{ backgroundColor: opts.color }}
          />
        </button>
        {openPanel === 'color' ? (
          <div
            data-testid="floating-toolbar-color-panel"
            className="absolute left-0 top-full z-10 mt-1 grid w-44 grid-cols-6 gap-1 rounded-md border border-primary/30 bg-background p-2 shadow-xl"
          >
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                data-testid={`floating-toolbar-color-${c.replace('#', '')}`}
                title={c}
                onClick={() => {
                  onChangeColor(c);
                  setOpenPanel('none');
                }}
                className={`h-6 w-6 rounded-sm border ${c === opts.color ? 'border-white ring-2 ring-primary' : 'border-white/20'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Thickness cycle */}
      <button
        type="button"
        data-testid="floating-toolbar-thickness"
        title={`Thickness (${opts.thickness}px)`}
        onClick={() => {
          const i = THICKNESS_CYCLE.indexOf(opts.thickness);
          const next = THICKNESS_CYCLE[(i + 1) % THICKNESS_CYCLE.length];
          onChangeThickness(next);
        }}
        className="flex h-7 w-10 items-center justify-center rounded text-xs font-semibold hover:bg-primary/10"
      >
        {opts.thickness}px
      </button>

      {/* Style cycle */}
      <button
        type="button"
        data-testid="floating-toolbar-style"
        title={`Style (${opts.style})`}
        onClick={() => {
          const i = STYLE_CYCLE.indexOf(opts.style);
          const next = STYLE_CYCLE[(i + 1) % STYLE_CYCLE.length];
          onChangeStyle(next);
        }}
        className="flex h-7 w-12 items-center justify-center rounded text-[10px] font-medium uppercase hover:bg-primary/10"
      >
        {opts.style === 'solid' ? '——' : opts.style === 'dashed' ? '- - -' : '· · ·'}
      </button>

      <span className="mx-1 h-5 w-px bg-primary/20" />

      {/* Add text */}
      <button
        type="button"
        data-testid="floating-toolbar-add-text"
        title="Add text"
        onClick={onAddText}
        className="flex h-7 items-center justify-center rounded px-2 text-xs font-semibold hover:bg-primary/10"
      >
        <span aria-hidden>T</span>
        <span className="ml-1 text-[11px] text-muted-foreground">+</span>
      </button>

      {/* Visibility */}
      <button
        type="button"
        data-testid="floating-toolbar-visible"
        title={isVisible ? 'Hide' : 'Show'}
        onClick={onToggleVisible}
        className="flex h-7 w-7 items-center justify-center rounded text-[11px] hover:bg-primary/10"
      >
        {isVisible ? '👁' : '⊘'}
      </button>

      {/* Lock */}
      <button
        type="button"
        data-testid="floating-toolbar-lock"
        title={isLocked ? 'Unlock' : 'Lock'}
        onClick={onToggleLock}
        className={`flex h-7 w-7 items-center justify-center rounded text-[11px] hover:bg-primary/10 ${isLocked ? 'text-amber-400' : ''}`}
      >
        {isLocked ? '🔒' : '🔓'}
      </button>

      {/* Duplicate */}
      <button
        type="button"
        data-testid="floating-toolbar-duplicate"
        title="Duplicate"
        onClick={onDuplicate}
        className="flex h-7 w-7 items-center justify-center rounded text-[11px] hover:bg-primary/10"
      >
        ⧉
      </button>

      <span className="mx-1 h-5 w-px bg-primary/20" />

      {/* Settings */}
      <button
        type="button"
        data-testid="floating-toolbar-settings"
        title="Settings"
        onClick={onOpenSettings}
        className="flex h-7 w-7 items-center justify-center rounded text-[11px] hover:bg-primary/10"
      >
        ⚙
      </button>

      {/* Delete */}
      <button
        type="button"
        data-testid="floating-toolbar-delete"
        title="Delete"
        onClick={onDelete}
        className="flex h-7 w-7 items-center justify-center rounded text-[11px] text-red-400 hover:bg-red-500/15"
      >
        🗑
      </button>
    </div>
  );

  return createPortal(toolbar, document.body);
}
