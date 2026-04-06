import { motion } from 'framer-motion';
import { useApp, Currency } from '@/context/AppContext';
import { scenarios } from '@/data/stockData';
import { useState } from 'react';
import BrandLottie from '@/components/BrandLottie';

interface TopBarProps {
  totalCandles: number;
  currentDate: string;
}

export default function TopBar({ totalCandles, currentDate }: TopBarProps) {
  const {
    scenarioId, setScenarioId, selectedStock, setSelectedStock,
    currentCandleIndex, setCurrentCandleIndex, initializeSimulation,
    stepBackward, stepForward,
    isPlaying, setIsPlaying, playSpeed, setPlaySpeed,
    currency, setCurrency, startDate, endDate, setDateRange, dataSource,
  } = useApp();

  const scenario = scenarios.find(s => s.id === scenarioId)!;
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'NYSE' | 'NASDAQ' | 'NSE' | 'BSE' | 'CRYPTO' | 'FOREX' | 'COMMODITIES'>('ALL');

  const availableMarkets = Array.from(new Set(scenario.stocks.map(s => s.market)));

  const filteredStocks = scenario.stocks.filter(s =>
    (marketFilter === 'ALL' || s.market === marketFilter) && (
      s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <motion.div
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="glass sticky top-0 z-50 px-3 md:px-4 py-3.5 backdrop-blur-xl border-b border-primary/25 shadow-[0_8px_28px_hsl(var(--background)/0.45)]"
    >
      <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
        <motion.div
          className="flex items-center gap-2.5 mr-2"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.2 }}>
            <BrandLottie size={44} className="shrink-0 drop-shadow-[0_0_12px_hsl(var(--neon-blue)/0.24)]" />
          </motion.div>
          <span className="font-display text-[1.36rem] leading-none font-semibold text-foreground tracking-wide whitespace-nowrap">Trade Replay</span>
        </motion.div>

        {/* Scenario Selector */}
        <select
          value={scenarioId}
          onChange={e => {
            setScenarioId(e.target.value);
            setTimeout(() => { void initializeSimulation(); }, 0);
          }}
          className="premium-select px-3 py-1.5 rounded-lg text-foreground text-sm focus:outline-none cursor-pointer"
        >
          {scenarios.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={marketFilter}
          onChange={e => setMarketFilter(e.target.value as typeof marketFilter)}
          className="premium-select px-3 py-1.5 rounded-lg text-foreground text-sm focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Markets</option>
          {availableMarkets.map(market => (
            <option key={market} value={market}>{market}</option>
          ))}
        </select>

        {/* Stock Selector */}
        <div className="relative">
          <button
            onClick={() => setShowStockSearch(!showStockSearch)}
            className="premium-select px-3 py-1.5 rounded-lg text-foreground text-sm font-mono hover:bg-secondary/70 transition-colors"
          >
            {scenario.stocks.find(s => s.symbol === selectedStock)?.icon ?? '📈'} {selectedStock}
          </button>
          {showStockSearch && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full mt-1 left-0 glass-strong rounded-lg p-2 min-w-[220px] max-w-[min(92vw,300px)] z-50 shadow-[0_18px_36px_hsl(var(--background)/0.5)]"
            >
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="premium-input w-full px-2 py-1.5 rounded text-foreground text-xs mb-2 focus:outline-none"
                autoFocus
              />
              {filteredStocks.map(s => (
                <button
                  key={s.symbol}
                  onClick={() => {
                    setSelectedStock(s.symbol);
                    setShowStockSearch(false);
                    setSearch('');
                    setTimeout(() => { void initializeSimulation(); }, 0);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-secondary/50 transition-colors ${
                    s.symbol === selectedStock ? 'bg-primary/20 text-primary' : 'text-foreground'
                  }`}
                >
                  <span className="font-mono font-semibold">{s.icon} {s.symbol}</span>
                  <span className="text-muted-foreground ml-2">{s.name} • {s.market}</span>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        <input
          type="date"
          value={startDate}
          onChange={e => setDateRange(e.target.value, endDate)}
          className="premium-input px-2 py-1 rounded text-foreground text-xs"
        />
        <input
          type="date"
          value={endDate}
          onChange={e => setDateRange(startDate, e.target.value)}
          className="premium-input px-2 py-1 rounded text-foreground text-xs"
        />
        <button
          onClick={() => void initializeSimulation()}
          className="premium-select px-2 py-1 rounded text-xs"
        >
          Apply
        </button>

        {/* Date */}
        <motion.span
          key={currentDate}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-mono text-muted-foreground hidden lg:inline"
        >
          {currentDate}
        </motion.span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Simulation Controls */}
        <div className="flex items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => void stepBackward()}
            className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors text-sm"
            title="Step back"
          >
            ⏮
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-1.5 px-3 rounded-lg font-semibold text-sm transition-all interactive-cta ${
              isPlaying
                ? 'bg-primary/20 text-primary glow-blue'
                : 'bg-secondary/50 text-foreground hover:bg-secondary/70'
            }`}
          >
            {isPlaying ? '⏸' : '▶'}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => void stepForward()}
            className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors text-sm"
            title="Step forward"
          >
            ⏭
          </motion.button>

          {/* Speed */}
          <select
            value={playSpeed}
            onChange={e => void setPlaySpeed(+e.target.value)}
            className="premium-select px-2 py-1 rounded text-foreground text-xs focus:outline-none cursor-pointer"
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={5}>5×</option>
            <option value={10}>10×</option>
          </select>
        </div>

        {/* Timeline Slider */}
        <input
          type="range"
          min={0}
          max={totalCandles - 1}
          value={currentCandleIndex}
          onChange={e => void setCurrentCandleIndex(+e.target.value)}
          className="w-20 md:w-36 accent-primary h-1"
        />

        <span className="text-xs text-muted-foreground">
          {dataSource ? (dataSource === 'fallback' ? 'Fallback' : 'AlphaVantage') : 'No source'}
        </span>

        <select
          value={currency}
          onChange={e => setCurrency(e.target.value as Currency)}
          className="premium-select px-2 py-1 rounded-lg text-xs font-mono text-foreground hover:bg-secondary/70 transition-colors"
        >
          <option value="USD">$ USD</option>
          <option value="INR">₹ INR</option>
          <option value="EUR">€ EUR</option>
          <option value="GBP">£ GBP</option>
          <option value="JPY">¥ JPY</option>
        </select>
      </div>
    </motion.div>
  );
}
