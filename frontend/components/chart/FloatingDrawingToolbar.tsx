/**
 * FloatingDrawingToolbar — TradingView-parity selection toolbar.
 *
 * Displayed when a drawing is selected; rendered in a React portal so that
 * chart container's `backdrop-filter` does not clip it, and so it floats
 * above the chart overlay canvas.
 *
 * Actions:
 *   • color swatch  → opens TV-style palette
 *   • thickness     → opens 1 / 2 / 3 / 4 px dropdown for verified Trend Line
 *   • style         → opens solid / dashed / dotted dropdown for verified Trend Line
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
import { getVerifiedToolbarControlIdsForDrawing } from '@/services/tools/floatingToolbarModel';

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
const STYLE_LABELS: Record<'solid' | 'dashed' | 'dotted', string> = {
  solid: 'Line',
  dashed: 'Dashed line',
  dotted: 'Dotted line',
};

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

  const [openPanel, setOpenPanel] = useState<'none' | 'color' | 'textColor' | 'thickness' | 'style'>('none');
  const [textColorByDrawing, setTextColorByDrawing] = useState<Record<string, string>>({});

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpenPanel('none');
      }
    };
    window.addEventListener('mousedown', onGlobalMouseDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', onGlobalMouseDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
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
  const verifiedControls = getVerifiedToolbarControlIdsForDrawing(drawing);
  const isVerifiedTrendLineToolbar = drawing.variant === 'trend';
  const textColor = textColorByDrawing[drawing.id] ?? opts.color;

  const toolbar = (
    <div
      data-floating-toolbar
      data-testid="floating-drawing-toolbar"
      data-drawing-id={drawing.id}
      data-verified-controls={verifiedControls.join(' ')}
      role="toolbar"
      aria-label="Drawing toolbar"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex,
      }}
      className="flex items-center gap-1 rounded-md border border-primary/30 bg-background/95 px-2 py-1 shadow-xl backdrop-blur-md"
    >
      {isVerifiedTrendLineToolbar ? (
        <button
          type="button"
          data-name="templates"
          data-testid="floating-toolbar-templates"
          title="Templates"
          aria-label="Templates"
          onClick={() => setOpenPanel('none')}
          className="flex h-7 w-7 items-center justify-center rounded text-[11px] font-semibold hover:bg-primary/10"
        >
          T
        </button>
      ) : null}

      {/* Color swatch with popover */}
      <div className="relative">
        <button
          type="button"
          data-name="line-tool-color"
          data-testid="floating-toolbar-color"
          aria-label="Line color"
          aria-expanded={openPanel === 'color'}
          data-selected-value={opts.color}
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
            data-selected-color={opts.color}
            className="absolute left-0 top-full z-10 mt-1 grid w-44 grid-cols-6 gap-1 rounded-md border border-primary/30 bg-background p-2 shadow-xl"
          >
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                data-testid={`floating-toolbar-color-${c.replace('#', '')}`}
                aria-label={`Stroke color ${c}`}
                aria-pressed={c === opts.color}
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

      {isVerifiedTrendLineToolbar ? (
        <div className="relative">
          <button
            type="button"
            data-name="text-color"
            data-testid="floating-toolbar-text-color"
            title="Text color"
            aria-label="Text color"
            aria-expanded={openPanel === 'textColor'}
            data-selected-value={textColor}
            onClick={() => setOpenPanel((p) => (p === 'textColor' ? 'none' : 'textColor'))}
            className="flex h-7 w-7 items-center justify-center rounded text-[11px] font-bold hover:bg-primary/10"
          >
            <span className="flex items-center gap-1">
              <span>A</span>
              <span
                className="h-2 w-2 rounded-full border border-white/40"
                style={{ backgroundColor: textColor }}
              />
            </span>
          </button>
          {openPanel === 'textColor' ? (
            <div
              data-testid="floating-toolbar-text-color-panel"
              data-selected-color={textColor}
              className="absolute left-0 top-full z-10 mt-1 grid w-44 grid-cols-6 gap-1 rounded-md border border-primary/30 bg-background p-2 shadow-xl"
            >
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  data-testid={`floating-toolbar-text-color-${c.replace('#', '')}`}
                  aria-label={`Text color ${c}`}
                  aria-pressed={c === textColor}
                  title={c}
                  onClick={() => {
                    setTextColorByDrawing((prev) => ({ ...prev, [drawing.id]: c }));
                    setOpenPanel('none');
                  }}
                  className={`h-6 w-6 rounded-sm border ${c === textColor ? 'border-white ring-2 ring-primary' : 'border-white/20'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Thickness cycle/dropdown */}
      <div className="relative">
        <button
          type="button"
          data-name="line-tool-width"
          data-testid="floating-toolbar-thickness"
          aria-label="Line width"
          aria-expanded={openPanel === 'thickness'}
          data-selected-value={String(opts.thickness)}
          title={`Thickness (${opts.thickness}px)`}
          onClick={() => {
            if (isVerifiedTrendLineToolbar) {
              setOpenPanel((p) => (p === 'thickness' ? 'none' : 'thickness'));
              return;
            }
            const i = THICKNESS_CYCLE.indexOf(opts.thickness);
            const next = THICKNESS_CYCLE[(i + 1) % THICKNESS_CYCLE.length];
            onChangeThickness(next);
          }}
          className="flex h-7 w-10 items-center justify-center rounded text-xs font-semibold hover:bg-primary/10"
        >
          {opts.thickness}px
        </button>
        {isVerifiedTrendLineToolbar && openPanel === 'thickness' ? (
          <div
            data-testid="floating-toolbar-thickness-panel"
            className="absolute left-0 top-full z-10 mt-1 w-28 rounded-md border border-primary/30 bg-background p-1 shadow-xl"
          >
            {THICKNESS_CYCLE.map((value) => (
              <button
                key={value}
                type="button"
                data-testid={`floating-toolbar-thickness-option-${value}`}
                aria-pressed={value === opts.thickness}
                onClick={() => {
                  onChangeThickness(value);
                  setOpenPanel('none');
                }}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-primary/10 ${value === opts.thickness ? 'text-primary' : ''}`}
              >
                <span>{value}px</span>
                <span
                  aria-hidden
                  className="rounded bg-current"
                  style={{ width: Math.max(18, value * 10), height: value }}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Style cycle/dropdown */}
      <div className="relative">
        <button
          type="button"
          data-name="style"
          data-testid="floating-toolbar-style"
          aria-label="Line style"
          aria-expanded={openPanel === 'style'}
          data-selected-value={opts.style}
          title={`Style (${opts.style})`}
          onClick={() => {
            if (isVerifiedTrendLineToolbar) {
              setOpenPanel((p) => (p === 'style' ? 'none' : 'style'));
              return;
            }
            const i = STYLE_CYCLE.indexOf(opts.style);
            const next = STYLE_CYCLE[(i + 1) % STYLE_CYCLE.length];
            onChangeStyle(next);
          }}
          className="flex h-7 w-12 items-center justify-center rounded text-[10px] font-medium uppercase hover:bg-primary/10"
        >
          {opts.style === 'solid' ? '——' : opts.style === 'dashed' ? '- - -' : '· · ·'}
        </button>
        {isVerifiedTrendLineToolbar && openPanel === 'style' ? (
          <div
            data-testid="floating-toolbar-style-panel"
            className="absolute left-0 top-full z-10 mt-1 w-36 rounded-md border border-primary/30 bg-background p-1 shadow-xl"
          >
            {STYLE_CYCLE.map((style) => (
              <button
                key={style}
                type="button"
                data-testid={`floating-toolbar-style-option-${style}`}
                aria-pressed={style === opts.style}
                onClick={() => {
                  onChangeStyle(style);
                  setOpenPanel('none');
                }}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-primary/10 ${style === opts.style ? 'text-primary' : ''}`}
              >
                <span>{STYLE_LABELS[style]}</span>
                <span aria-hidden>{style === 'solid' ? '——' : style === 'dashed' ? '- - -' : '· · ·'}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

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
        data-name="lock"
        data-testid="floating-toolbar-lock"
        aria-label={isLocked ? 'Unlock' : 'Lock'}
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
        data-name="settings"
        data-testid="floating-toolbar-settings"
        aria-label="Settings"
        title="Settings"
        onClick={onOpenSettings}
        className="flex h-7 w-7 items-center justify-center rounded text-[11px] hover:bg-primary/10"
      >
        ⚙
      </button>

      {isVerifiedTrendLineToolbar ? (
        <button
          type="button"
          data-name="add-alert"
          data-testid="floating-toolbar-add-alert"
          title="Add alert"
          aria-label="Add alert"
          onClick={() => setOpenPanel('none')}
          className="flex h-7 w-7 items-center justify-center rounded text-[11px] hover:bg-primary/10"
        >
          !
        </button>
      ) : null}

      {/* Delete */}
      <button
        type="button"
        data-name="remove"
        data-testid="floating-toolbar-delete"
        aria-label="Remove"
        title="Delete"
        onClick={onDelete}
        className="flex h-7 w-7 items-center justify-center rounded text-[11px] text-red-400 hover:bg-red-500/15"
      >
        🗑
      </button>
      {isVerifiedTrendLineToolbar ? (
        <button
          type="button"
          data-name="more"
          data-testid="floating-toolbar-more"
          title="More"
          aria-label="More"
          onClick={() => setOpenPanel('none')}
          className="flex h-7 w-7 items-center justify-center rounded text-[13px] hover:bg-primary/10"
        >
          ...
        </button>
      ) : null}
    </div>
  );

  return createPortal(toolbar, document.body);
}
