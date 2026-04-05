import TradingChart from "@/components/chart/TradingChart";
import { useApp } from "@/context/AppContext";
import type { CandleData } from "@/data/stockData";

interface SimChartProps {
  data: CandleData[];
  visibleCount: number;
}

export default function SimChart({ data, visibleCount }: SimChartProps) {
  const { selectedStock } = useApp();
  return <TradingChart data={data} visibleCount={visibleCount} symbol={selectedStock} />;
}
