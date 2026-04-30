import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import { RotateCcw, Bell, TrendingDown, TrendingUp, LayoutGrid, Settings, ChevronRight } from "lucide-react";

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
  onSellOrder?: (price: number) => void;
  onBuyOrder?: (price: number) => void;
  onAddOrder?: (price: number) => void;
}

const MENU_WIDTH = 268;
const MENU_EST_HEIGHT = 440;

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
  onSellOrder,
  onBuyOrder,
  onAddOrder,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type LucideIcon = React.ComponentType<any>;

  function item(
    label: string,
    shortcut: string | null,
    onClick: () => void,
    className = "",
    Icon?: LucideIcon,
  ) {
    return (
      <button
        key={label}
        type="button"
        onClick={() => { onClick(); onClose(); }}
        className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-foreground hover:bg-primary/10 active:bg-primary/20 active:text-primary ${className}`}
      >
        {Icon ? <Icon size={13} className="shrink-0 text-muted-foreground" /> : <span className="w-[13px] shrink-0" />}
        <span className="flex-1 text-left">{label}</span>
        {shortcut && <span className="ml-auto text-[10px] text-muted-foreground">{shortcut}</span>}
      </button>
    );
  }

  const menu = (
    <div
      ref={menuRef}
      data-testid="chart-context-menu"
      className="fixed z-[200] w-[268px] rounded-xl border border-primary/20 bg-background/95 py-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
      style={{ left: menuX, top: menuY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {item("Reset chart view", "Alt+R", onResetView, "", RotateCcw)}
      {item(`Copy price ${priceLabel}`, null, onCopyPrice)}
      {item("Paste", "Ctrl+V", () => {})}

      <div className="my-1 mx-3 border-t border-border/40" />

      {item(`Add alert on ${symbol} at ${priceLabel}...`, "Alt+A", onAddAlert, "", Bell)}
      {item(
        `Sell 1 ${symbol} @ ${priceLabel} limit`,
        "Alt+Shift+S",
        () => onSellOrder?.(cursorPrice ?? 0),
        "text-rose-400 hover:bg-rose-500/10",
        TrendingDown,
      )}
      {item(
        `Buy 1 ${symbol} @ ${priceLabel} stop`,
        null,
        () => onBuyOrder?.(cursorPrice ?? 0),
        "text-emerald-400 hover:bg-emerald-500/10",
        TrendingUp,
      )}
      {item(
        `Add order on ${symbol}...`,
        "Shift+T",
        () => onAddOrder?.(cursorPrice ?? 0),
        "",
        LayoutGrid,
      )}

      <button
        type="button"
        onClick={() => { onToggleLockCrosshair(); onClose(); }}
        className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] hover:bg-primary/10 active:bg-primary/20 active:text-primary ${lockedCrosshair ? "text-primary" : "text-foreground"}`}
      >
        <span className="w-[13px] shrink-0" />
        <span className="flex-1 text-left">Lock vertical cursor line by time</span>
        {lockedCrosshair && <span className="text-[10px] text-primary">●</span>}
      </button>

      <div className="my-1 mx-3 border-t border-border/40" />

      {item("Table view", null, onTableView)}
      {item("Object tree", null, onObjectTree)}

      {/* Chart template submenu */}
      <div className="group relative">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-foreground hover:bg-primary/10"
        >
          <span className="w-[13px] shrink-0" />
          <span className="flex-1 text-left">Chart template</span>
          <ChevronRight size={12} className="ml-auto text-muted-foreground" />
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
      {item("Settings...", null, onSettings, "", Settings)}
    </div>
  );

  return createPortal(menu, document.body);
}
