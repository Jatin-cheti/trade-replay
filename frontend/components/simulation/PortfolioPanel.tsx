import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { CandleData, getStockInfo } from '@/data/stockData';
import { toast } from 'sonner';
import InteractiveSurface from '@/components/ui/InteractiveSurface';

interface PortfolioPanelProps {
  stockCandles: Record<string, CandleData[]>;
  candleIndex: number;
}

export default function PortfolioPanel({ stockCandles, candleIndex }: PortfolioPanelProps) {
  const { balance, holdings, formatCurrency, importPortfolioCsv } = useApp();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const holdingsValue = holdings.reduce((sum, h) => {
    const candles = stockCandles[h.symbol];
    const price = candles?.[candleIndex]?.close ?? h.avgPrice;
    return sum + h.quantity * price;
  }, 0);

  const totalValue = balance + holdingsValue;
  const pnl = totalValue - 100000;
  const pnlPercent = ((pnl / 100000) * 100).toFixed(2);
  const isProfit = pnl >= 0;

  return (
    <InteractiveSurface className="glass-strong rounded-2xl p-5 card-lift gradient-border section-hover-reveal">
      <h3 className="text-base font-semibold text-muted-foreground mb-4 tracking-[0.1em]">PORTFOLIO</h3>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Cash</span>
          <span className="font-mono text-sm text-foreground">{formatCurrency(balance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Holdings</span>
          <span className="font-mono text-sm text-foreground">{formatCurrency(holdingsValue)}</span>
        </div>
        <div className="border-t border-border my-2" />
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">Total Value</span>
          <motion.span
            key={totalValue.toFixed(0)}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="font-mono text-sm font-semibold text-foreground"
          >
            {formatCurrency(totalValue)}
          </motion.span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">P&L</span>
          <motion.span
            key={pnl.toFixed(0)}
            initial={{ scale: 1.2, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`font-mono text-sm font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}
          >
            {isProfit ? '+' : ''}{formatCurrency(pnl)} ({pnlPercent}%)
          </motion.span>
        </div>
      </div>

      {holdings.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs text-muted-foreground mb-2 tracking-[0.08em]">HOLDINGS</h4>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {holdings.map(h => {
              const price = stockCandles[h.symbol]?.[candleIndex]?.close ?? h.avgPrice;
              const pl = (price - h.avgPrice) * h.quantity;
              const info = getStockInfo(h.symbol);
              return (
                <div key={h.symbol} className="flex justify-between items-center text-xs">
                  <span className="font-mono text-foreground">{info?.icon ?? '📈'} {h.symbol} × {h.quantity}</span>
                  <span className={`font-mono ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {pl >= 0 ? '+' : ''}{formatCurrency(pl)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground mb-2">Import CSV (symbol, quantity, avgPrice)</p>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="premium-select px-2 py-1 rounded text-xs cursor-pointer hover:bg-secondary/70 transition-colors">
            Choose CSV
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          {csvFile && <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">{csvFile.name}</span>}
          <button
            onClick={async () => {
              if (!csvFile) {
                toast.error('Please select a CSV file first');
                return;
              }
              setIsUploading(true);
              const ok = await importPortfolioCsv(csvFile);
              setIsUploading(false);
              if (ok) {
                toast.success('Portfolio imported into simulation');
                return;
              }
              toast.error('Portfolio CSV import failed');
            }}
            disabled={isUploading}
            className="premium-select px-2 py-1 rounded text-xs disabled:opacity-60 interactive-cta"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </InteractiveSurface>
  );
}
