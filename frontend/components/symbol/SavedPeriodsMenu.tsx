/**
 * SavedPeriodsMenu — dropdown for viewing, selecting, editing, deleting saved periods.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  Check,
  ChevronDown,
  Edit2,
  Inbox,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import type { SavedPeriod } from "./useSavedPeriods";
import type { CustomRange } from "./CustomRangePicker";

interface SavedPeriodsMenuProps {
  periods: SavedPeriod[];
  activePeriodId?: string;
  onSelect: (period: SavedPeriod) => void;
  onOpenCustom: (initialRange?: CustomRange, editId?: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, name: string) => void;
}

function formatRangeLabel(range: CustomRange): string {
  try {
    if (range.mode === "time") {
      return `${format(range.from, "HH:mm")} – ${format(range.to, "HH:mm")}`;
    }
    if (range.mode === "datetime") {
      return `${format(range.from, "MMM d HH:mm")} – ${format(range.to, "MMM d HH:mm")}`;
    }
    return `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;
  } catch {
    return "—";
  }
}

export default function SavedPeriodsMenu({
  periods,
  activePeriodId,
  onSelect,
  onOpenCustom,
  onDelete,
  onEdit,
}: SavedPeriodsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const periodItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Position the portaled menu above or below the trigger based on viewport space.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const btn = triggerRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const menuH = menuRef.current?.offsetHeight ?? 360;
      const menuW = 288; // w-72
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= menuH + 16
        ? rect.bottom + 6
        : Math.max(8, rect.top - menuH - 6);
      const left = Math.min(
        Math.max(8, rect.right - menuW),
        window.innerWidth - menuW - 8
      );
      setMenuPos({ top, left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setConfirmDelete(null);
      setEditingId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmDelete(null);
        setEditingId(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (!open) return;

    const animationId = window.requestAnimationFrame(() => {
      const activeIndex = periods.findIndex((period) => period.id === activePeriodId);
      if (activeIndex >= 0 && periodItemRefs.current[activeIndex]) {
        periodItemRefs.current[activeIndex]?.focus();
        return;
      }
      const firstFocusable = periodItemRefs.current.find((item) => item !== null);
      firstFocusable?.focus();
    });

    return () => window.cancelAnimationFrame(animationId);
  }, [activePeriodId, open, periods]);

  const startEdit = (period: SavedPeriod) => {
    setEditingId(period.id);
    setEditName(period.name);
  };

  const commitEdit = () => {
    if (!editingId || !editName.trim()) {
      setEditingId(null);
      return;
    }
    onEdit(editingId, editName.trim());
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditingId(null);
  };

  const activePeriod = activePeriodId
    ? periods.find((p) => p.id === activePeriodId)
    : null;

  const focusNextPeriodItem = (currentIndex: number, step: 1 | -1) => {
    if (periods.length === 0) return;
    for (let offset = 1; offset <= periods.length; offset += 1) {
      const nextIndex = (currentIndex + step * offset + periods.length) % periods.length;
      const candidate = periodItemRefs.current[nextIndex];
      if (candidate) {
        candidate.focus();
        return;
      }
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setConfirmDelete(null);
      setEditingId(null);
      triggerRef.current?.focus();
      return;
    }

    const currentIndex = periodItemRefs.current.findIndex((item) => item === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusNextPeriodItem(currentIndex >= 0 ? currentIndex : -1, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusNextPeriodItem(currentIndex >= 0 ? currentIndex : 0, -1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      periodItemRefs.current[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      periodItemRefs.current[periods.length - 1]?.focus();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={() => { setOpen((v) => !v); setConfirmDelete(null); }}
        className={`h-8 flex items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors
          ${open || activePeriodId
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/30"
          }`}
        title="Saved periods"
        aria-label={activePeriod ? `Saved periods — active: ${activePeriod.name}` : "Saved periods"}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <Bookmark className="w-3.5 h-3.5" />
        <span className="hidden sm:inline max-w-[100px] truncate">
          {activePeriod ? activePeriod.name : "Saved"}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && menuPos && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            id={menuId}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[200] w-72 rounded-xl border border-border/50 bg-background/98 backdrop-blur-xl shadow-2xl overflow-hidden"
            role="menu"
            aria-label="Saved periods"
            onKeyDown={handleMenuKeyDown}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-primary" />
                Saved periods
              </span>
              <button
                onClick={() => { onOpenCustom(); setOpen(false); }}
                className="h-6 flex items-center gap-1 rounded-md border border-border/40 px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
                role="menuitem"
              >
                <Plus className="w-3 h-3" />
                New
              </button>
            </div>

            {/* Period list */}
            <div className="max-h-64 overflow-y-auto">
              {periods.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Inbox className="w-7 h-7 opacity-40" />
                  <p className="text-xs">No saved periods yet</p>
                  <button
                    onClick={() => { onOpenCustom(); setOpen(false); }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Create one now
                  </button>
                </div>
              ) : (
                <div className="p-1.5 space-y-0.5">
                  {periods.map((period) => (
                    <div
                      key={period.id}
                      className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors
                        ${activePeriodId === period.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-secondary/30 border border-transparent"
                        }`}
                    >
                      {editingId === period.id ? (
                        <input
                          ref={editInputRef}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          className="flex-1 bg-secondary/40 border border-primary/30 rounded px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                      ) : (
                        <button
                          ref={(node) => { periodItemRefs.current[periods.findIndex((p) => p.id === period.id)] = node; }}
                          className="flex-1 text-left"
                          onClick={() => { onSelect(period); setOpen(false); }}
                          aria-label={`Select saved period: ${period.name}`}
                          aria-pressed={activePeriodId === period.id}
                          role="menuitemradio"
                          aria-checked={activePeriodId === period.id}
                        >
                          <p className="text-xs font-medium text-foreground leading-none truncate">
                            {period.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatRangeLabel(period.range)}
                          </p>
                        </button>
                      )}

                      {/* Actions */}
                      {editingId !== period.id && confirmDelete !== period.id && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(period)}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                            title="Rename"
                            aria-label={`Rename ${period.name}`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(period.id)}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                            aria-label={`Delete ${period.name}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Delete confirm inline */}
                      {confirmDelete === period.id && editingId !== period.id && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Delete?</span>
                          <button
                            onClick={() => { onDelete(period.id); setConfirmDelete(null); }}
                            className="h-5 flex items-center gap-0.5 rounded px-1.5 text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          >
                            <Check className="w-2.5 h-2.5" /> Yes
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {activePeriodId === period.id && editingId !== period.id && (
                        <span className="text-[10px] text-primary font-medium shrink-0">Active</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {periods.length > 0 && (
              <div className="px-3 py-2 border-t border-border/20">
                <p className="text-[10px] text-muted-foreground/60">
                  {periods.length} saved period{periods.length !== 1 ? "s" : ""} · Stored locally
                </p>
              </div>
            )}
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
