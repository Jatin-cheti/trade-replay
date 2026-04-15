import { ArrowLeft } from "lucide-react";
import AssetAvatar from "@/components/ui/AssetAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssetSearchItem } from "@/lib/assetSearch";

const FALLBACK_ICON = "/icons/exchange/default.svg";

interface FutureContractsViewProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  selectedSymbol: string;
  selectedFutureRoot: AssetSearchItem;
  onBack: () => void;
  onSelect: (item: AssetSearchItem) => void;
}

export function FutureContractsView({
  open,
  onOpenChange,
  selectedSymbol,
  selectedFutureRoot,
  onBack,
  onSelect,
}: FutureContractsViewProps) {
  const contracts = selectedFutureRoot.contracts ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="symbol-search-modal" className="w-[min(960px,94vw)] max-w-none gap-0 border-border/80 bg-background/95 p-0 backdrop-blur-xl">
        <DialogHeader className="flex flex-row items-center gap-3 border-b border-border/60 px-5 pt-5 pb-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-1 transition-colors hover:bg-secondary/60"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <DialogTitle className="font-display text-xl">{selectedFutureRoot.ticker} Contracts</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
            <AssetAvatar src={selectedFutureRoot.iconUrl || FALLBACK_ICON} label={selectedFutureRoot.name} className="h-8 w-8 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{selectedFutureRoot.ticker}</p>
              <p className="truncate text-xs text-muted-foreground">{selectedFutureRoot.name}</p>
            </div>
          </div>

          <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-border/70">
            {contracts.map((contract) => (
              <button
                key={`${contract.ticker}-${contract.exchange}`}
                data-testid="symbol-contract-row"
                data-symbol={contract.ticker}
                type="button"
                onClick={() => {
                  onSelect(contract);
                  onOpenChange(false);
                }}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-secondary/45 ${
                  contract.ticker === selectedSymbol ? "bg-secondary/65" : "bg-secondary/20"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <AssetAvatar src={contract.iconUrl || FALLBACK_ICON} label={contract.name} className="h-7 w-7 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{contract.ticker}</p>
                    <p className="truncate text-xs text-muted-foreground">{contract.name}</p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AssetAvatar src={contract.exchangeLogoUrl || contract.exchangeIcon} label={contract.exchange} className="h-4 w-4 rounded-sm object-cover" />
                  <span className="font-medium text-foreground">{contract.exchange}</span>
                </div>
              </button>
            ))}
            {contracts.length === 0 ? (
              <p className="px-3 py-4 text-sm text-center text-muted-foreground">No contracts available</p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}