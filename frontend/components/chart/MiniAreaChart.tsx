import { useMemo, useRef, useEffect, useState } from "react";

interface MiniAreaChartProps {
  data: { time: string; close: number }[];
  width?: number;
  height?: number;
  className?: string;
  color?: string;
  showTooltip?: boolean;
}

/**
 * Lightweight SVG area chart for symbol page overview.
 * Renders close prices as a filled area with gradient.
 */
export default function MiniAreaChart({
  data,
  width: propWidth,
  height = 280,
  className = "",
  color,
  showTooltip = true,
}: MiniAreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(propWidth ?? 800);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Responsive width
  useEffect(() => {
    if (propWidth) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, [propWidth]);

  const width = propWidth ?? containerWidth;

  const { points, fillPath, linePath, minVal, maxVal, isGain } = useMemo(() => {
    if (data.length < 2) return { points: [], fillPath: "", linePath: "", minVal: 0, maxVal: 0, isGain: true };

    const closes = data.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const pad = 24;
    const chartW = width - pad * 2;
    const chartH = height - pad * 2;
    const isGainVal = closes[closes.length - 1] >= closes[0];

    const pts = closes.map((v, i) => ({
      x: pad + (i / (closes.length - 1)) * chartW,
      y: pad + chartH - ((v - min) / range) * chartH,
      value: v,
      time: data[i].time,
    }));

    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const fillD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${height - pad} L ${pts[0].x.toFixed(1)} ${height - pad} Z`;

    return { points: pts, fillPath: fillD, linePath: lineD, minVal: min, maxVal: max, isGain: isGainVal };
  }, [data, width, height]);

  const chartColor = color ?? (isGain ? "#26a69a" : "#ef5350");

  if (data.length < 2) {
    return (
      <div className={`flex items-center justify-center text-muted-foreground text-sm ${className}`} style={{ height }}>
        No chart data available
      </div>
    );
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ height }}>
      <svg
        width={width}
        height={height}
        className="cursor-crosshair"
        onMouseMove={(e) => {
          if (!showTooltip) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          let closest = 0;
          let closestDist = Infinity;
          for (let i = 0; i < points.length; i++) {
            const dist = Math.abs(points[i].x - x);
            if (dist < closestDist) { closestDist = dist; closest = i; }
          }
          setHoverIndex(closest);
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Filled area */}
        <path d={fillPath} fill="url(#area-grad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={chartColor} strokeWidth={2} />

        {/* Crosshair on hover */}
        {hovered && (
          <>
            <line x1={hovered.x} y1={24} x2={hovered.x} y2={height - 24} stroke={chartColor} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.6} />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill={chartColor} stroke="var(--background)" strokeWidth={2} />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hovered && showTooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg border border-border/50 bg-background/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-sm"
          style={{
            left: Math.min(hovered.x + 12, width - 140),
            top: Math.max(hovered.y - 45, 0),
          }}
        >
          <div className="text-muted-foreground text-[10px]">{hovered.time}</div>
          <div className="font-semibold text-foreground tabular-nums">
            {hovered.value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )}
    </div>
  );
}
