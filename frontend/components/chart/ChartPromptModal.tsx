import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import type { ToolOptions } from '@/services/tools/toolOptions';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface ChartPromptRequest {
  title: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  /** Show a live preview of the value (e.g. emoji preview) */
  preview?: boolean;
  allowStyleControls?: boolean;
  styleOptions?: Partial<Pick<ToolOptions, 'font' | 'textSize' | 'bold' | 'italic' | 'align' | 'textBackground' | 'textBorder'>>;
}

interface ChartPromptModalProps {
  request: ChartPromptRequest | null;
  onConfirm: (payload: {
    value: string;
    style: Partial<Pick<ToolOptions, 'font' | 'textSize' | 'bold' | 'italic' | 'align' | 'textBackground' | 'textBorder'>>;
  }) => void;
  onCancel: () => void;
  portalZIndex?: number;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function ChartPromptModal({ request, onConfirm, onCancel, portalZIndex = 50 }: ChartPromptModalProps) {
  const [value, setValue] = useState('');
  const [font, setFont] = useState('JetBrains Mono');
  const [textSize, setTextSize] = useState(12);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('left');
  const [textBackground, setTextBackground] = useState(true);
  const [textBorder, setTextBorder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stylePayload = {
    font,
    textSize,
    bold,
    italic,
    align,
    textBackground,
    textBorder,
  };

  useEffect(() => {
    if (request) {
      setValue(request.defaultValue);
      setFont(request.styleOptions?.font ?? 'JetBrains Mono');
      setTextSize(request.styleOptions?.textSize ?? 12);
      setBold(request.styleOptions?.bold ?? false);
      setItalic(request.styleOptions?.italic ?? false);
      setAlign(request.styleOptions?.align ?? 'left');
      setTextBackground(request.styleOptions?.textBackground ?? true);
      setTextBorder(request.styleOptions?.textBorder ?? false);
      // focus after dialog renders
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [request]);

  const handleSubmit = useCallback(() => {
    const currentValue = inputRef.current?.value ?? value;
    const trimmed = currentValue.trim();
    onConfirm({
      value: trimmed || request?.defaultValue || '',
      style: stylePayload,
    });
  }, [onConfirm, request?.defaultValue, stylePayload, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel],
  );

  if (!request) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60" style={{ zIndex: portalZIndex }} />
        <div
          data-testid="chart-prompt-modal"
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: portalZIndex + 1 }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
          <div className="w-full max-w-sm rounded-xl border border-primary/25 bg-background shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-primary/15 px-4 py-3">
              <span className="text-sm font-semibold text-foreground">{request.title}</span>
              <button
                type="button"
                data-testid="chart-prompt-cancel"
                onClick={onCancel}
                className="rounded-md p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-4">
              {/* Preview */}
              {request.preview && value.trim() && (
                <div className="mb-3 flex items-center justify-center rounded-lg border border-border/50 bg-muted/20 py-3">
                  <span
                    style={{
                      fontFamily: font,
                      fontSize: `${Math.max(14, textSize)}px`,
                      fontWeight: bold ? 700 : 400,
                      fontStyle: italic ? 'italic' : 'normal',
                      textAlign: align,
                    }}
                    className="max-w-[90%] break-words"
                  >
                    {value}
                  </span>
                </div>
              )}

              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{request.label}</label>
              <input
                ref={inputRef}
                data-testid="chart-prompt-input"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={request.placeholder || request.defaultValue}
                className="w-full rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground"
                autoFocus
              />

              {request.allowStyleControls ? (
                <div className="mt-3 space-y-2 rounded-lg border border-border/50 bg-muted/10 p-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-muted-foreground">
                      Font
                      <select value={font} onChange={(event) => setFont(event.target.value)} className="mt-1 w-full rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px]">
                        <option value="JetBrains Mono">JetBrains Mono</option>
                        <option value="Poppins">Poppins</option>
                        <option value="IBM Plex Sans">IBM Plex Sans</option>
                        <option value="Space Grotesk">Space Grotesk</option>
                      </select>
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      Size
                      <input type="range" min={10} max={28} step={1} value={textSize} onChange={(event) => setTextSize(Number(event.target.value))} className="mt-2 w-full" />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setBold((prev) => !prev)} className={`rounded-md border px-2 py-1 text-[11px] ${bold ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground'}`}>Bold</button>
                    <button type="button" onClick={() => setItalic((prev) => !prev)} className={`rounded-md border px-2 py-1 text-[11px] ${italic ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground'}`}>Italic</button>
                    <select value={align} onChange={(event) => setAlign(event.target.value as 'left' | 'center' | 'right')} className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTextBackground((prev) => !prev)} className={`rounded-md border px-2 py-1 text-[11px] ${textBackground ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground'}`}>Background</button>
                    <button type="button" onClick={() => setTextBorder((prev) => !prev)} className={`rounded-md border px-2 py-1 text-[11px] ${textBorder ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground'}`}>Border</button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-primary/10 px-4 py-3">
              <button
                type="button"
                data-testid="chart-prompt-cancel-btn"
                onClick={onCancel}
                className="rounded-lg border border-border/70 px-4 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/30 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="chart-prompt-ok"
                onClick={handleSubmit}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
