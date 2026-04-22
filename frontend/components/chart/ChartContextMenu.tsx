import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

interface ChartContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  symbol: string;
  cursorPrice: number | null;
  activeIndicatorsCount: number;
  lockedCrosshair: boolean;
  onClose: () => void;
  onResetView: () => void;
  onCopyPrice: () => void;
  onAddAlert: () => void;
  onToggleLockCrosshair: () => void;
  onTableView: () => void;
  onObjectTree: () => void;
  onSaveTemplate: () => void;
  onLoadTemplate: () => void;
  onRemoveIndicators: () => void;
  onSettings: () => void;
}

const MENU_WIDTH = 248;
const MENU_EST_HEIGHT = 340;

export default function ChartContextMenu({
  open,
  x,
  y,
  symbol,
  cursorPrice,
  activeIndicatorsCount,
  lockedCrosshair,
  onClose,
  onResetView,
  onCopyPrice,
  onAddAlert,
  onToggleLockCrosshair,
  onTableView,
  onObjectTree,
  onSaveTemplate,
  onLoadTemplate,
  onRemoveIndicators,
  onSettings,
}: ChartContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuX = x + MENU_WIDTH > vw ? Math.max(4, vw - MENU_WIDTH - 4) : x;
  const menuY = y + MENU_EST_HEIGHT > vh ? Math.max(4, vh - MENU_EST_HEIGHT - 4) : y;

  const priceLabel = cursorPrice != null ? cursorPrice.toFixed(2) : "—";

  function item(label: string, shortcut: string | null, onClick: () => void, className = "") {
    return (
      <button
        key={label}
        type="button"
        onClick={() => { onClick(); onClose(); }}
        className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-[12px] text-foreground hover:bg-primary/10 active:bg-primary/20 active:text-primary ${className}`}
      >
        <span>{label}</span>
        {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
      </button>
    );
  }

  const menu = (
    <div
      ref={menuRef}
      data-testid="chart-context-menu"
      className="fixed z-[200] w-[248px] rounded-xl border border-primary/20 bg-background/95 py-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
      style={{ left: menuX, top: menuY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {item("Reset chart view", "Alt+R", onResetView)}
      {item(`Copy price ${priceLabel}`, null, onCopyPrice)}
      {item("Paste", "Ctrl+V", () => {})}

      <div className="my-1 mx-3 border-t border-border/40" />

      {item(`Add alert on ${symbol} at ${priceLabel}...`, "Alt+A", onAddAlert)}
      <button
        type="button"
        onClick={() => { onToggleLockCrosshair(); onClose(); }}
        className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-[12px] hover:bg-primary/10 active:bg-primary/20 active:text-primary ${lockedCrosshair ? "text-primary" : "text-foreground"}`}
      >
        <span>Lock vertical cursor line by time</span>
        {lockedCrosshair && <span className="text-[10px] text-primary">●</span>}
      </button>

      <div className="my-1 mx-3 border-t border-border/40" />

      {item("Table view", null, onTableView)}
      {item("Object tree", null, onObjectTree)}

      {/* Chart template submenu */}
      <div className="group relative">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-[12px] text-foreground hover:bg-primary/10"
        >
          <span>Chart template</span>
          <span className="text-[10px] text-muted-foreground">▸</span>
        </button>
        <div className="absolute left-full top-0 z-10 hidden w-40 rounded-xl border border-primary/20 bg-background/95 py-1.5 shadow-2xl backdrop-blur-xl group-hover:block">
          {item("Save template...", null, onSaveTemplate)}
          {item("Load template...", null, onLoadTemplate)}
        </div>
      </div>

      {activeIndicatorsCount > 0 && (
        <>
          <div className="my-1 mx-3 border-t border-border/40" />
          {item(
            `Remove ${activeIndicatorsCount} indicator${activeIndicatorsCount === 1 ? "" : "s"}`,
            null,
            onRemoveIndicators,
            "text-rose-400 hover:bg-rose-500/10",
          )}
        </>
      )}

      <div className="my-1 mx-3 border-t border-border/40" />
      {item("Settings...", null, onSettings)}
    </div>
  );

  return createPortal(menu, document.body);
}
