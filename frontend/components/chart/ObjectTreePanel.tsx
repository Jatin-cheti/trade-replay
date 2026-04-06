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
    <aside className={`absolute bottom-3 z-30 rounded-xl border border-primary/25 bg-background/85 p-2 backdrop-blur-xl transition-all duration-200 ${isMobile ? `left-3 right-3 ${open ? 'translate-y-0 opacity-100' : 'translate-y-[78%] opacity-95'}` : `right-3 w-[320px] ${open ? 'max-h-[42vh] opacity-100' : 'max-h-[58px] opacity-95'}`}`}>
      <div className="mb-1 flex items-center justify-between">
        <button type="button" onClick={onTogglePanel} className="inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">
          <span>Object Tree</span>
          <span>{open ? '−' : '+'}</span>
        </button>
        <span className="text-[11px] text-muted-foreground">{drawings.length} objects</span>
      </div>

      {open && (
        <div className="max-h-[34vh] space-y-1 overflow-y-auto">
          {drawings.slice().reverse().map((drawing) => {
            const selected = selectedDrawingId === drawing.id;
            return (
              <div key={drawing.id} className={`rounded-md border px-2 py-1.5 text-[11px] ${selected ? 'border-primary/45 bg-primary/10' : 'border-border/60 bg-background/40'}`}>
                <div className="flex items-center justify-between gap-1">
                  <button type="button" onClick={() => onSelect(drawing.id)} className="text-left text-foreground/90 hover:text-foreground">
                    {drawing.variant}
                  </button>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onToggleVisible(drawing.id)} className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground">
                      {drawing.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button type="button" onClick={() => onToggleLocked(drawing.id)} className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground">
                      {drawing.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                    </button>
                    <button type="button" onClick={() => onDelete(drawing.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive">
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
