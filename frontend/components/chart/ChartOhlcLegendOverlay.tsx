interface OhlcRow {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface ChartOhlcLegendOverlayProps {
  symbol: string;
  exchange?: string;
  row: OhlcRow | null;
  prevClose?: number | null;
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

export default function ChartOhlcLegendOverlay({
  symbol,
  exchange,
  row,
  prevClose,
}: ChartOhlcLegendOverlayProps) {
  if (!row) return null;

  const change = row.close - row.open;
  const changePct = row.open !== 0 ? (change / row.open) * 100 : 0;
  const isPositive = change >= 0;

  const prevChangeAbs = prevClose != null ? row.close - prevClose : null;
  const prevChangePct = prevClose != null && prevClose !== 0 ? ((row.close - prevClose) / prevClose) * 100 : null;

  return (
    <div
      data-testid="chart-ohlc-legend"
      className="pointer-events-none absolute left-2 top-2 z-30 flex flex-col gap-0.5 rounded-md bg-background/60 px-2.5 py-1.5 backdrop-blur-sm"
    >
      {/* Symbol + exchange */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-bold text-foreground">{symbol}</span>
        {exchange && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{exchange}</span>
        )}
      </div>

      {/* OHLCV */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
        <span className="text-[11px] text-muted-foreground">
          O <span className="tabular-nums text-foreground">{fmt2(row.open)}</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          H <span className="tabular-nums text-emerald-300">{fmt2(row.high)}</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          L <span className="tabular-nums text-rose-300">{fmt2(row.low)}</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          C <span className={`tabular-nums font-semibold ${isPositive ? "text-emerald-300" : "text-rose-300"}`}>{fmt2(row.close)}</span>
        </span>
        {row.volume != null && row.volume > 0 && (
          <span className="text-[11px] text-muted-foreground">
            V{" "}
            <span className="tabular-nums text-foreground">
              {row.volume >= 1e7
                ? `${(row.volume / 1e7).toFixed(2)}Cr`
                : row.volume >= 1e5
                  ? `${(row.volume / 1e5).toFixed(2)}L`
                  : row.volume.toLocaleString()}
            </span>
          </span>
        )}
      </div>

      {/* Change vs open */}
      <div className="flex items-center gap-2">
        <span className={`text-[11px] tabular-nums font-semibold ${isPositive ? "text-emerald-300" : "text-rose-300"}`}>
          {isPositive ? "+" : ""}{fmt2(change)} ({isPositive ? "+" : ""}{changePct.toFixed(2)}%)
        </span>
        {prevChangeAbs != null && prevChangePct != null && (
          <span className={`text-[10px] tabular-nums ${prevChangeAbs >= 0 ? "text-emerald-300/70" : "text-rose-300/70"}`}>
            vs prev {prevChangeAbs >= 0 ? "+" : ""}{fmt2(prevChangeAbs)} ({prevChangePct.toFixed(2)}%)
          </span>
        )}
      </div>
    </div>
  );
}
