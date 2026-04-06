import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Pause, Play, Search, SkipBack, SkipForward } from 'lucide-react';
import BrandLottie from '@/components/BrandLottie';
import AssetAvatar from '@/components/ui/AssetAvatar';
import PremiumSelect from '@/components/simulation/PremiumSelect';
import PremiumDatePicker from '@/components/simulation/PremiumDatePicker';
import SymbolSearchModal from '@/components/simulation/SymbolSearchModal';
import { useApp, Currency } from '@/context/AppContext';
import { scenarios } from '@/data/stockData';
import type { AssetSearchItem } from '@/lib/assetSearch';

interface TopBarProps {
  totalCandles: number;
  currentDate: string;
}

export default function TopBar({ totalCandles, currentDate }: TopBarProps) {
  const {
    scenarioId,
    setScenarioId,
    selectedStock,
    setSelectedStock,
    currentCandleIndex,
    setCurrentCandleIndex,
    initializeSimulation,
    stepBackward,
    stepForward,
    isPlaying,
    setIsPlaying,
    playSpeed,
    setPlaySpeed,
    currency,
    setCurrency,
    startDate,
    endDate,
    setDateRange,
    dataSource,
  } = useApp();

  const [marketFilter, setMarketFilter] = useState<'ALL' | 'NYSE' | 'NASDAQ' | 'NSE' | 'BSE' | 'CRYPTO' | 'FOREX' | 'COMMODITIES'>('ALL');
  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);
  const [selectedAssetMeta, setSelectedAssetMeta] = useState<AssetSearchItem | null>(null);

  const scenario = scenarios.find((item) => item.id === scenarioId)!;

  const scenarioOptions = useMemo(
    () => scenarios.map((item) => ({ value: item.id, label: item.name, subtitle: item.description })),
    []
  );

  const marketOptions = useMemo(() => {
    const set = new Set(scenario.stocks.map((item) => item.market));
    return [{ value: 'ALL', label: 'All Markets' }, ...Array.from(set).map((m) => ({ value: m, label: m }))] as Array<{ value: typeof marketFilter; label: string }>;
  }, [scenario.stocks]);

  const selectedScenarioStock = useMemo(
    () => scenario.stocks.find((item) => item.symbol === selectedStock),
    [scenario.stocks, selectedStock]
  );

  const selectedAssetName = selectedAssetMeta?.name || selectedScenarioStock?.name || selectedStock;
  const selectedAssetIcon = selectedAssetMeta?.iconUrl || selectedAssetMeta?.logoUrl || selectedScenarioStock?.icon;
  const selectedExchangeIcon = selectedAssetMeta?.exchangeLogoUrl || selectedAssetMeta?.exchangeIcon;

  return (
    <motion.div
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="glass sticky top-[70px] z-40 border-b border-primary/25 px-3 py-3.5 shadow-[0_8px_28px_hsl(var(--background)/0.45)] backdrop-blur-xl md:px-4"
    >
      <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
        <motion.div className="mr-1 flex items-center gap-2.5" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.2 }}>
            <BrandLottie size={44} className="shrink-0 drop-shadow-[0_0_12px_hsl(var(--neon-blue)/0.24)]" />
          </motion.div>
          <span className="whitespace-nowrap font-display text-[1.36rem] font-semibold leading-none tracking-wide text-foreground">Trade Replay</span>
        </motion.div>

        <PremiumSelect
          value={scenarioId}
          options={scenarioOptions}
          searchable
          onChange={(next) => {
            setScenarioId(next);
            setTimeout(() => {
              void initializeSimulation();
            }, 0);
          }}
          className="min-w-[230px]"
        />

        <PremiumSelect
          value={marketFilter}
          options={marketOptions}
          onChange={(next) => setMarketFilter(next as typeof marketFilter)}
          className="min-w-[160px]"
        />

        <div className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-background/55 px-3 py-1.5 text-sm">
          <AssetAvatar
            src={selectedAssetIcon}
            label={selectedAssetName}
            className="h-4 w-4 rounded-full object-cover ring-1 ring-border/70"
          />
          <button
            data-testid="scenario-symbol-trigger"
            type="button"
            onClick={() => setSymbolSearchOpen(true)}
            className="inline-flex min-w-[240px] items-center justify-between gap-3 rounded-md border border-border/70 bg-secondary/35 px-2.5 py-1.5 text-left hover:bg-secondary/55"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{selectedStock}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{selectedAssetName}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {selectedExchangeIcon ? <AssetAvatar src={selectedExchangeIcon} label={selectedAssetMeta?.exchange || 'exchange'} className="h-3.5 w-3.5 rounded-sm object-cover" /> : null}
              <Search size={13} />
            </span>
          </button>
        </div>

        <PremiumDatePicker label="Start" value={startDate} onChange={(next) => setDateRange(next, endDate)} />
        <PremiumDatePicker label="End" value={endDate} onChange={(next) => setDateRange(startDate, next)} />

        <button onClick={() => void initializeSimulation()} className="rounded-lg border border-primary/20 bg-primary/12 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20">
          Apply
        </button>

        <motion.span key={currentDate} initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} className="hidden text-xs font-mono text-muted-foreground lg:inline">
          {currentDate}
        </motion.span>

        <div className="flex-1" />

        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 px-1 py-1">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => void stepBackward()} className="rounded p-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground" title="Step back">
            <SkipBack size={16} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsPlaying(!isPlaying)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
              isPlaying ? 'bg-primary/20 text-primary glow-blue' : 'bg-secondary/50 text-foreground hover:bg-secondary/70'
            }`}
          >
            {isPlaying ? <Pause size={16} className="mx-auto" /> : <Play size={16} className="mx-auto" />}
          </motion.button>

          <motion.button whileTap={{ scale: 0.9 }} onClick={() => void stepForward()} className="rounded p-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground" title="Step forward">
            <SkipForward size={16} />
          </motion.button>

          <PremiumSelect
            value={String(playSpeed)}
            options={[{ value: '0.5', label: '0.5×' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '5', label: '5×' }, { value: '10', label: '10×' }]}
            onChange={(next) => void setPlaySpeed(Number(next))}
            className="min-w-[88px]"
          />
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(0, totalCandles - 1)}
          value={currentCandleIndex}
          onChange={(event) => void setCurrentCandleIndex(+event.target.value)}
          className="h-1 w-20 accent-primary md:w-36"
        />

        <span className="text-xs text-muted-foreground">
          {dataSource ? (dataSource === 'fallback' ? 'Fallback' : 'AlphaVantage') : 'No source'}
        </span>

        <PremiumSelect
          value={currency}
          options={[
            { value: 'USD', label: '$ USD' },
            { value: 'INR', label: '₹ INR' },
            { value: 'EUR', label: '€ EUR' },
            { value: 'GBP', label: '£ GBP' },
            { value: 'JPY', label: '¥ JPY' },
          ] as Array<{ value: Currency; label: string }>}
          onChange={(next) => setCurrency(next as Currency)}
          className="min-w-[104px]"
        />
      </div>

      <SymbolSearchModal
        open={symbolSearchOpen}
        selectedSymbol={selectedStock}
        onOpenChange={setSymbolSearchOpen}
        onSelect={(asset) => {
          setSelectedAssetMeta(asset);
          setSelectedStock(asset.symbol);
          setTimeout(() => {
            void initializeSimulation({ symbol: asset.symbol });
          }, 0);
        }}
      />
    </motion.div>
  );
}
