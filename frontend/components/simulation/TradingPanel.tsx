import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { CandleData, getStockInfo } from '@/data/stockData';
import { toast } from 'sonner';
import InteractiveSurface from '@/components/ui/InteractiveSurface';

interface TradingPanelProps {
  currentCandle: CandleData | null;
}

export default function TradingPanel({ currentCandle }: TradingPanelProps) {
  const { selectedStock, executeTrade, formatCurrency } = useApp();
  const [quantity, setQuantity] = useState(10);
  const [flash, setFlash] = useState<'buy' | 'sell' | null>(null);
  const [activeTrade, setActiveTrade] = useState<'BUY' | 'SELL' | null>(null);

  const price = currentCandle?.close ?? 0;
  const stockInfo = getStockInfo(selectedStock);

  const handleTrade = async (type: 'BUY' | 'SELL') => {
    if (!currentCandle) return;
    setActiveTrade(type);
    const success = await executeTrade(type, selectedStock, price, quantity, currentCandle.time);
    setActiveTrade(null);
    if (success) {
      setFlash(type === 'BUY' ? 'buy' : 'sell');
      setTimeout(() => setFlash(null), 600);
      toast.success(`${type} order executed for ${selectedStock}`);
      return;
    }
    toast.error(`${type} order failed`);
  };

  return (
    <InteractiveSurface className="glass-strong rounded-2xl p-5 relative overflow-hidden card-lift gradient-border section-hover-reveal">
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={`absolute inset-0 ${flash === 'buy' ? 'bg-neon-green' : 'bg-neon-red'} z-0`}
          />
        )}
      </AnimatePresence>

      <h3 className="text-base font-semibold text-muted-foreground mb-4 relative z-10 tracking-[0.1em]">TRADE</h3>

      <div className="space-y-3 relative z-10">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Stock</span>
          <span className="font-mono font-semibold text-foreground">{stockInfo?.icon ?? '📈'} {selectedStock}</span>
        </div>

        <div className="text-xs text-muted-foreground -mt-1">{stockInfo?.name ?? 'Unknown Asset'} • {stockInfo?.market ?? 'N/A'}</div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Price</span>
          <motion.span
            key={price}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono font-semibold text-foreground"
          >
            {formatCurrency(price)}
          </motion.span>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={e => setQuantity(Math.max(1, +e.target.value))}
            className="premium-input w-full px-3 py-2 rounded-lg text-foreground font-mono text-sm focus:outline-none"
          />
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Total</span>
          <span className="font-mono">{formatCurrency(price * quantity)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleTrade('BUY')}
            disabled={activeTrade !== null}
            className="py-2.5 rounded-lg bg-neon-green/20 border border-neon-green/40 text-profit font-semibold text-sm hover:bg-neon-green/30 transition-all glow-green disabled:opacity-60"
          >
            {activeTrade === 'BUY' ? 'BUYING...' : 'BUY'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleTrade('SELL')}
            disabled={activeTrade !== null}
            className="py-2.5 rounded-lg bg-neon-red/20 border border-neon-red/40 text-loss font-semibold text-sm hover:bg-neon-red/30 transition-all glow-red disabled:opacity-60"
          >
            {activeTrade === 'SELL' ? 'SELLING...' : 'SELL'}
          </motion.button>
        </div>
      </div>
    </InteractiveSurface>
  );
}
