import { useMemo, useRef, useEffect, useState, useCallback } from "react";

interface MiniAreaChartProps {
  data: { time: string; close: number }[];
  width?: number;
  height?: number;
  className?: string;
  color?: string;
  showTooltip?: boolean;
  currency?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Generate nice Y-axis tick values */
function niceYTicks(min: number, max: number, count = 6): number[] {
  const range = max - min || 1;
  const rawStep = range / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 2.5, 5, 10];
  let step = mag;
  for (const ns of niceSteps) {
    if (ns * mag >= rawStep) { step = ns * mag; break; }
  }
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) {
    if (v >= min - step * 0.5) ticks.push(v);
  }
  return ticks;
}

/** Format time label from ISO string */
function fmtTimeLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  } catch { return ""; }
}

/** Format date for tooltip: "17 Apr '26" */
function fmtTooltipDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const mon = d.toLocaleString("en", { month: "short" });
    const yr = String(d.getFullYear()).slice(-2);
    return `${day} ${mon} '${yr}`;
  } catch { return iso; }
}

/** Format tooltip time with UTC offset: "22:38 UTC+5:30" */
function fmtTooltipTime(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const oh = Math.floor(Math.abs(off) / 60);
    const om = Math.abs(off) % 60;
    const tz = om > 0 ? `UTC${sign}${oh}:${om.toString().padStart(2, "0")}` : `UTC${sign}${oh}`;
    return `${h}:${m} ${tz}`;
  } catch { return ""; }
}

/** Format price for Y-axis labels */
function fmtPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (v >= 100) return v.toFixed(1);
  return v.toFixed(2);
}

/* ── Component ───────────────────────────────────────────────────── */

export default function MiniAreaChart({
  data,
  width: propWidth,
  height = 340,
  className = "",
  color,
  showTooltip = true,
  currency,
}: MiniAreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(propWidth ?? 800);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (propWidth) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, [propWidth]);

  const width = propWidth ?? containerWidth;
  const PADDING = { top: 16, right: 65, bottom: 36, left: 12 };

  const { points, fillPath, linePath, minVal, maxVal, isGain, yTicks, timeLabels } = useMemo(() => {
    if (data.length < 2) return { points: [], fillPath: "", linePath: "", minVal: 0, maxVal: 0, isGain: true, yTicks: [], timeLabels: [] };

    const closes = data.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const chartW = width - PADDING.left - PADDING.right;
    const chartH = height - PADDING.top - PADDING.bottom;
    const isGainVal = closes[closes.length - 1] >= closes[0];

    const pts = closes.map((v, i) => ({
      x: PADDING.left + (i / (closes.length - 1)) * chartW,
      y: PADDING.top + chartH - ((v - min) / range) * chartH,
      value: v,
      time: data[i].time,
    }));

    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const bottomY = PADDING.top + chartH;
    const fillD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${bottomY} L ${pts[0].x.toFixed(1)} ${bottomY} Z`;

    const yTicks = niceYTicks(min, max, 6);

    // Generate time labels: show ~8-12 labels evenly spaced
    const labelCount = Math.min(Math.max(6, Math.floor(width / 120)), 14);
    const step = Math.max(1, Math.floor(data.length / labelCount));
    const tl: Array<{ x: number; label: string; dateLabel?: string }> = [];
    let lastDateStr = "";
    for (let i = 0; i < data.length; i += step) {
      const x = PADDING.left + (i / (data.length - 1)) * chartW;
      const timeStr = fmtTimeLabel(data[i].time);
      // Show date boundary
      const dateStr = new Date(data[i].time).toLocaleDateString("en", { day: "numeric" });
      const showDate = dateStr !== lastDateStr;
      lastDateStr = dateStr;
      tl.push({ x, label: timeStr, dateLabel: showDate ? dateStr : undefined });
    }

    return { points: pts, fillPath: fillD, linePath: lineD, minVal: min, maxVal: max, isGain: isGainVal, yTicks, timeLabels: tl };
  }, [data, width, height]);

  const chartColor = color ?? (isGain ? "#26a69a" : "#ef5350");
  const gradId = "mini-area-grad";

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!showTooltip || points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - x);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoverIndex(closest);
  }, [showTooltip, points]);

  if (data.length < 2) {
    return (
      <div className={`flex items-center justify-center text-muted-foreground text-sm ${className}`} style={{ height }}>
        No chart data available
      </div>
    );
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const chartBottom = height - PADDING.bottom;
  const chartTop = PADDING.top;
  const chartRight = width - PADDING.right;
  const lastPrice = points[points.length - 1];

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ height }}>
      <svg
        width={width}
        height={height}
        className="cursor-crosshair select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.22} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick) => {
          const range = maxVal - minVal || 1;
          const chartH = chartBottom - chartTop;
          const y = chartTop + chartH - ((tick - minVal) / range) * chartH;
          if (y < chartTop - 5 || y > chartBottom + 5) return null;
          return (
            <g key={tick}>
              <line x1={PADDING.left} y1={y} x2={chartRight} y2={y} stroke="currentColor" className="text-border/30" strokeWidth={0.5} />
              <text x={chartRight + 8} y={y + 4} className="text-muted-foreground" fill="currentColor" fontSize={11} fontFamily="system-ui, sans-serif">
                {fmtPrice(tick)}
              </text>
            </g>
          );
        })}

        {/* X-axis time labels */}
        {timeLabels.map((tl, i) => (
          <g key={i}>
            <line x1={tl.x} y1={chartTop} x2={tl.x} y2={chartBottom} stroke="currentColor" className="text-border/15" strokeWidth={0.5} />
            <text x={tl.x} y={chartBottom + 14} textAnchor="middle" className="text-muted-foreground" fill="currentColor" fontSize={10} fontFamily="system-ui, sans-serif">
              {tl.label}
            </text>
            {tl.dateLabel && (
              <text x={tl.x} y={chartBottom + 26} textAnchor="middle" className="text-muted-foreground" fill="currentColor" fontSize={10} fontWeight={600} fontFamily="system-ui, sans-serif">
                {tl.dateLabel}
              </text>
            )}
          </g>
        ))}

        {/* Filled area */}
        <path d={fillPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={chartColor} strokeWidth={1.5} strokeLinejoin="round" />

        {/* Last price horizontal dashed line + badge */}
        {lastPrice && (
          <>
            <line x1={lastPrice.x} y1={lastPrice.y} x2={chartRight} y2={lastPrice.y} stroke={chartColor} strokeWidth={0.7} strokeDasharray="2,2" opacity={0.6} />
            <rect x={chartRight + 2} y={lastPrice.y - 10} width={PADDING.right - 8} height={20} rx={3} fill={chartColor} />
            <text x={chartRight + PADDING.right / 2 - 1} y={lastPrice.y + 4} textAnchor="middle" fill="white" fontSize={10} fontWeight={600} fontFamily="system-ui, sans-serif">
              {fmtPrice(lastPrice.value)}
            </text>
          </>
        )}

        {/* Crosshair on hover */}
        {hovered && (
          <>
            <line x1={hovered.x} y1={chartTop} x2={hovered.x} y2={chartBottom} stroke="currentColor" className="text-muted-foreground" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.5} />
            <line x1={PADDING.left} y1={hovered.y} x2={chartRight} y2={hovered.y} stroke="currentColor" className="text-muted-foreground" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.3} />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill={chartColor} stroke="var(--background)" strokeWidth={2} />
          </>
        )}
      </svg>

      {/* Tooltip — TradingView style: dark bg, price on top, date + time below */}
      {hovered && showTooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-md bg-[#1e222d] px-3 py-2 text-xs shadow-xl"
          style={{
            left: Math.min(Math.max(hovered.x - 50, 8), width - 160),
            top: Math.max(hovered.y - 68, 4),
          }}
        >
          <div className="font-bold text-white tabular-nums text-sm">
            {hovered.value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{currency ? ` ${currency}` : ""}
          </div>
          <div className="text-[#787b86] text-[10px] mt-0.5">{fmtTooltipDate(hovered.time)}</div>
          <div className="text-[#787b86] text-[10px]">{fmtTooltipTime(hovered.time)}</div>
        </div>
      )}
    </div>
  );
}
