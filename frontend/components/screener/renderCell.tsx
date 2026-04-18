import AssetAvatar from "@/components/ui/AssetAvatar";
import type { ScreenerItem } from "@/lib/screener";
import { NUMERIC_COLUMNS, formatCompactNumber, formatDateValue, formatPercent, formatPrice } from "@/lib/screener";

export default function renderCell(item: ScreenerItem, columnKey: string) {
  if (columnKey === "symbol") {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <AssetAvatar src={item.iconUrl} label={item.symbol} className="h-7 w-7 shrink-0 rounded-full object-contain bg-white/90 p-0.5 ring-1 ring-border/40" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.symbol}</p>
          <p className="truncate text-[11px] text-muted-foreground">{item.name}</p>
        </div>
      </div>
    );
  }
  if (columnKey === "changePercent" || columnKey === "perfPercent" || columnKey === "epsDilGrowth") {
    const raw = item[columnKey as keyof ScreenerItem];
    if (raw === null || raw === undefined) return <span className="text-xs text-muted-foreground">—</span>;
    const num = Number(raw);
    if (!Number.isFinite(num) || num === 0) return <span className="text-xs text-muted-foreground">—</span>;
    return <span className={`text-xs font-semibold tabular-nums ${num > 0 ? "text-emerald-400" : ""} ${num < 0 ? "text-red-400" : "text-muted-foreground"}`}>{formatPercent(num)}</span>;
  }
  if (columnKey === "analystRating") {
    const rating = item.analystRating;
    if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
    const cfgs: Record<string, { icon: string; color: string; label: string }> = {
      "strong-buy": { icon: "↑", color: "#26a69a", label: "Strong buy" }, "Strong Buy": { icon: "↑", color: "#26a69a", label: "Strong buy" },
      buy: { icon: "↑", color: "#26a69a", label: "Buy" }, Buy: { icon: "↑", color: "#26a69a", label: "Buy" },
      neutral: { icon: "—", color: "#9598a1", label: "Neutral" }, Neutral: { icon: "—", color: "#9598a1", label: "Neutral" },
      sell: { icon: "↓", color: "#ef5350", label: "Sell" }, Sell: { icon: "↓", color: "#ef5350", label: "Sell" },
      "strong-sell": { icon: "↓", color: "#ef5350", label: "Strong sell" }, "Strong Sell": { icon: "↓", color: "#ef5350", label: "Strong sell" },
    };
    const cfg = cfgs[rating] ?? { icon: "—", color: "#9598a1", label: rating };
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: cfg.color }}><span>{cfg.icon}</span><span>{cfg.label}</span></span>;
  }
  if (columnKey === "price") return <span className="text-xs tabular-nums text-foreground">{formatPrice(item.price)}</span>;
  if (columnKey === "recentEarningsDate" || columnKey === "upcomingEarningsDate") return <span className="text-xs text-foreground/85">{formatDateValue(item[columnKey as keyof ScreenerItem] as string | undefined)}</span>;
  const raw = item[columnKey as keyof ScreenerItem];
  if (NUMERIC_COLUMNS.has(columnKey)) {
    if (raw === null || raw === undefined) return <span className="text-xs text-muted-foreground">—</span>;
    const num = Number(raw);
    if (!Number.isFinite(num) || num === 0) return <span className="text-xs text-muted-foreground">—</span>;
    if (columnKey === "pe" || columnKey === "peg" || columnKey === "beta" || columnKey === "roe" || columnKey === "relVolume" || columnKey === "epsDilTtm") return <span className="text-xs tabular-nums text-foreground">{num.toFixed(2)}</span>;
    if (columnKey === "divYieldPercent") return <span className="text-xs tabular-nums text-foreground">{formatPercent(num)}</span>;
    return <span className="text-xs tabular-nums text-foreground">{formatCompactNumber(num)}</span>;
  }
  if (columnKey === "sector") {
    let sector = item.sector;
    if (!sector) return <span className="text-xs text-muted-foreground">—</span>;
    if (sector.startsWith("Equity -") || sector.startsWith("equity -")) sector = "";
    if (sector === "stock" || sector === "Stock" || sector === "crypto" || sector === "Crypto") sector = "";
    if (!sector) return <span className="text-xs text-muted-foreground">—</span>;
    return <span className="truncate text-xs text-foreground/85">{sector}</span>;
  }
  return <span className="truncate text-xs text-foreground/85">{raw ? String(raw) : "—"}</span>;
}
