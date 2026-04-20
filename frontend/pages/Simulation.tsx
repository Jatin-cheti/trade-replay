import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { scenarios } from '@/data/stockData';
import ChartEngine from '@/components/chart/ChartEngine';
import TradingPanel from '@/components/simulation/TradingPanel';
import PortfolioPanel from '@/components/simulation/PortfolioPanel';
import TradeHistory from '@/components/simulation/TradeHistory';
import TopBar from '@/components/simulation/TopBar';
import BrandLottie from '@/components/BrandLottie';
import PageBirdsCloudsBackground from '@/components/background/PageBirdsCloudsBackground';
import ScrollReveal from '@/components/ScrollReveal';
import InteractiveSurface from '@/components/ui/InteractiveSurface';
import { BarChart3, History, Wallet, LineChart } from 'lucide-react';

export default function Simulation() {
  const {
    isAuthenticated, scenarioId, selectedStock,
    candles, allStockCandles: stockCache,
    currentCandleIndex,
    initializeSimulation, setScenarioId, setSelectedStock, setActivePortfolioId, isInitializingSimulation,
  } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parityDataEnabled = searchParams.get('parityData') === '1';
  const [mobileTab, setMobileTab] = useState<'chart' | 'trade' | 'portfolio' | 'history'>('chart');

  useEffect(() => {
    if (!isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      const portfolioId = searchParams.get('portfolioId') ?? undefined;
      const nextScenarioId = searchParams.get('scenarioId') ?? scenarioId;
      const scenario = scenarios.find(s => s.id === nextScenarioId);
      const nextSymbol = scenario?.stocks[0]?.symbol ?? selectedStock;

      if (portfolioId) {
        setActivePortfolioId(portfolioId);
      }

      if (nextScenarioId !== scenarioId) {
        setScenarioId(nextScenarioId);
      }

      if (nextSymbol !== selectedStock) {
        setSelectedStock(nextSymbol);
      }

      void initializeSimulation({
        portfolioId,
        scenarioId: nextScenarioId,
        symbol: nextSymbol,
        dataMode: parityDataEnabled ? 'parity-live' : 'default',
      });
    }
  }, [isAuthenticated, scenarioId, selectedStock, initializeSimulation, parityDataEnabled, searchParams, setActivePortfolioId, setScenarioId, setSelectedStock]);

  const scenario = scenarios.find(s => s.id === scenarioId)!;
  const allStockCandles = useMemo(() => {
    const map: Record<string, typeof candles> = {};
    scenario.stocks.forEach(s => {
      map[s.symbol] = stockCache[s.symbol] ?? [];
    });
    return map;
  }, [stockCache, candles, scenario.stocks]);

  const totalCandles = candles.length;
  const currentCandle = candles[currentCandleIndex] ?? null;
  const currentDate = currentCandle?.time ?? '';

  const tabs = [
    { id: 'chart' as const, icon: BarChart3, label: 'Chart' },
    { id: 'trade' as const, icon: LineChart, label: 'Trade' },
    { id: 'portfolio' as const, icon: Wallet, label: 'Portfolio' },
    { id: 'history' as const, icon: History, label: 'History' },
  ];

  return (
    <div data-testid="simulation-page" className="min-h-screen flex flex-col page-gradient-shell overflow-visible">
      <PageBirdsCloudsBackground showShellLayers showBirds={false} />
      <TopBar totalCandles={totalCandles} currentDate={currentDate} />

      <main className="relative z-10">

      {isInitializingSimulation && (
        <div className="px-3 pt-3">
          <div className="glass-strong rounded-lg p-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2.5">
              <BrandLottie size={40} className="shrink-0" />
              <p>Loading simulation data...</p>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Layout */}
      <motion.div
        className="flex-1 hidden md:flex gap-3 p-3 relative z-10"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.11 } },
        }}
      >
        {/* Chart */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          className="flex-[7]"
        >
          <InteractiveSurface className="glass-strong rounded-xl overflow-hidden gradient-border card-lift h-full">
            <ChartEngine
              data={candles}
              visibleCount={currentCandleIndex + 1}
              symbol={selectedStock}
              timeframe="1m"
              parityMode={parityDataEnabled}
            />
          </InteractiveSurface>
        </motion.div>

        {/* Right panels */}
        <div className="flex-[3] flex flex-col gap-3 min-w-[280px]">
          <motion.div
            variants={{ hidden: { opacity: 0, x: 18 }, show: { opacity: 1, x: 0 } }}
            className="gradient-border rounded-xl overflow-hidden"
          >
            <TradingPanel currentCandle={currentCandle} />
          </motion.div>
          <motion.div
            variants={{ hidden: { opacity: 0, x: 18 }, show: { opacity: 1, x: 0 } }}
            className="gradient-border rounded-xl overflow-hidden"
          >
            <PortfolioPanel stockCandles={allStockCandles} candleIndex={currentCandleIndex} />
          </motion.div>
        </div>
      </motion.div>

      {/* Trade History - Desktop */}
      <div className="hidden md:block px-3 pb-3 relative z-10 section-enter-delayed">
        <ScrollReveal delay={0.14}>
          <TradeHistory />
        </ScrollReveal>
      </div>

      {/* Mobile Layout */}
      <div className="flex-1 md:hidden p-3 relative z-10">
        {mobileTab === 'chart' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="h-[60vh]">
            <InteractiveSurface className="glass-strong rounded-xl overflow-hidden h-full gradient-border">
              <ChartEngine
                data={candles}
                visibleCount={currentCandleIndex + 1}
                symbol={selectedStock}
                timeframe="1m"
                parityMode={parityDataEnabled}
              />
            </InteractiveSurface>
          </motion.div>
        )}
        {mobileTab === 'trade' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="gradient-border rounded-xl overflow-hidden">
            <TradingPanel currentCandle={currentCandle} />
          </motion.div>
        )}
        {mobileTab === 'portfolio' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="gradient-border rounded-xl overflow-hidden">
            <PortfolioPanel stockCandles={allStockCandles} candleIndex={currentCandleIndex} />
          </motion.div>
        )}
        {mobileTab === 'history' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <TradeHistory />
          </motion.div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden glass sticky bottom-0 flex justify-around py-2 px-2 border-t border-border/70">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id)}
            className={`px-3 py-2 rounded-lg text-sm transition-all min-w-[78px] interactive-cta ${
              mobileTab === tab.id
                ? 'bg-primary/20 glow-blue text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex justify-center leading-none"><tab.icon size={16} /></span>
            <span className="block mt-1 text-[11px] uppercase tracking-wide">{tab.label}</span>
          </button>
        ))}
      </div>
      </main>
    </div>
  );
}
