import { Eye, EyeOff, Lock, LockOpen, Trash2 } from 'lucide-react';
import type { Drawing } from '@/services/tools/toolRegistry';

type ObjectTreePanelProps = {
  open: boolean;
  isMobile: boolean;
  drawings: Drawing[];
  selectedDrawingId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePanel: () => void;
};

export default function ObjectTreePanel({
  open,
  isMobile,
  drawings,
  selectedDrawingId,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onDelete,
  onTogglePanel,
}: ObjectTreePanelProps) {
  return (
    <aside data-testid="object-tree-panel" data-open={open ? 'true' : 'false'} className={`w-full rounded-xl border border-primary/25 bg-background/85 p-2 backdrop-blur-xl transition-all duration-200 ${isMobile ? `${open ? 'max-h-[40vh] opacity-100' : 'max-h-[52px] opacity-95'}` : `${open ? 'max-h-[42vh] opacity-100' : 'max-h-[58px] opacity-95'}`} `}>
      <div className="mb-1 flex items-center justify-between">
        <button type="button" onClick={onTogglePanel} className="inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">
          <span>Object Tree</span>
          <span>{open ? '−' : '+'}</span>
        </button>
        <span className="text-[11px] text-muted-foreground">{drawings.length} objects</span>
      </div>

      {open && (
        <div data-testid="object-tree-list" className="max-h-[30vh] space-y-1 overflow-y-auto">
          {drawings.slice().reverse().map((drawing) => {
            const selected = selectedDrawingId === drawing.id;
            return (
              <div key={drawing.id} data-testid={`drawing-object-${drawing.id}`} className={`rounded-md border px-2 py-1.5 text-[11px] ${selected ? 'border-primary/45 bg-primary/10' : 'border-border/60 bg-background/40'}`}>
                <div className="flex items-center justify-between gap-1">
                  <button type="button" data-testid={`drawing-select-${drawing.id}`} onClick={() => onSelect(drawing.id)} className="text-left text-foreground/90 hover:text-foreground" aria-label={`Select ${drawing.variant}`}>
                    {drawing.variant}
                  </button>
                  <div className="flex items-center gap-1">
                    <button type="button" data-testid={`drawing-visibility-${drawing.id}`} onClick={() => onToggleVisible(drawing.id)} className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground" aria-label={`Toggle visibility for ${drawing.variant}`}>
                      {drawing.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button type="button" data-testid={`drawing-lock-${drawing.id}`} onClick={() => onToggleLocked(drawing.id)} className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground" aria-label={`Toggle lock for ${drawing.variant}`}>
                      {drawing.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                    </button>
                    <button type="button" data-testid={`drawing-delete-${drawing.id}`} onClick={() => onDelete(drawing.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive" aria-label={`Delete ${drawing.variant}`}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
