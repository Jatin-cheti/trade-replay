import { useEffect, useState } from "react";

const PERIODS = [
  { key: "1d", label: "1D" },
  { key: "5d", label: "5D" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
  { key: "all", label: "All" },
] as const;

interface ChartTimeRangeBarProps {
  period: string;
  onPeriodChange: (period: string) => void;
  adjEnabled: boolean;
  onToggleAdj: () => void;
}

function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function formatIstClock(date: Date): string {
  // IST = UTC+5:30
  const utcMs = date.getTime();
  const istMs = utcMs + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  const ss = String(ist.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC+5:30`;
}

export default function ChartTimeRangeBar({
  period,
  onPeriodChange,
  adjEnabled,
  onToggleAdj,
}: ChartTimeRangeBarProps) {
  const now = useClock();

  return (
    <div
      data-testid="chart-time-range-bar"
      className="flex items-center justify-between border-t border-primary/15 bg-background/80 px-3 py-1 backdrop-blur-xl"
    >
      {/* Period pills */}
      <div className="flex items-center gap-0.5">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            data-testid={`period-btn-${key}`}
            onClick={() => onPeriodChange(key)}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
              period === key
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right side: clock + ADJ */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {formatIstClock(now)}
        </span>
        <button
          type="button"
          data-testid="adj-toggle"
          onClick={onToggleAdj}
          className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
            adjEnabled
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:bg-primary/10"
          }`}
        >
          ADJ
        </button>
      </div>
    </div>
  );
}
