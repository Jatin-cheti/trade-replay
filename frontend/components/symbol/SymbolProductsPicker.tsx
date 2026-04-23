import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AssetAvatar from "@/components/ui/AssetAvatar";
import {
  getProductTabsForAssetClass,
  resolveSourceLogo,
  type ProductAssetClass,
  type ProductRow,
  type ProductTab,
} from "@/components/symbol/productPickerData";

type SymbolProductsPickerProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  assetClass: ProductAssetClass;
  currentSymbol: string;
  currentSource: string;
  onSelect: (row: ProductRow) => void;
};

function SourceBadge({ source }: { source: string }) {
  const logo = resolveSourceLogo(source);
  if (logo) {
    return <AssetAvatar src={logo} label={source} className="h-4 w-4 rounded-sm object-cover" />;
  }

  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] font-semibold text-white">
      {source.slice(0, 1).toUpperCase()}
    </span>
  );
}

function IsinCopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.5 16.5L19.5 4.5L18.75 3.75H9L8.25 4.5L8.25 7.5L5.25 7.5L4.5 8.25V20.25L5.25 21H15L15.75 20.25V17.25H18.75L19.5 16.5ZM15.75 15.75L15.75 8.25L15 7.5L9.75 7.5V5.25L18 5.25V15.75H15.75ZM6 9L14.25 9L14.25 19.5L6 19.5L6 9Z"
        fill="#080341"
      />
    </svg>
  );
}

async function copyText(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to textarea fallback.
    }
  }

  try {
    const el = document.createElement("textarea");
    el.value = value;
    el.setAttribute("readonly", "true");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function gridTemplateForTab(tab: ProductTab): string {
  const keys = tab.columns.map((column) => column.key);
  if (keys.includes("isin")) return "1fr 1fr 0.8fr";
  if (keys.includes("description")) return "0.8fr 1.5fr 0.8fr";
  return "1fr 0.8fr";
}

export default function SymbolProductsPicker({
  open,
  onOpenChange,
  assetClass,
  currentSymbol,
  currentSource,
  onSelect,
}: SymbolProductsPickerProps) {
  const tabs = useMemo(() => getProductTabsForAssetClass(assetClass), [assetClass]);
  const [activeTabKey, setActiveTabKey] = useState<string>(tabs[0]?.key ?? "stocks");

  useEffect(() => {
    setActiveTabKey(tabs[0]?.key ?? "stocks");
  }, [tabs, open]);

  const activeTab = tabs.find((tab) => tab.key === activeTabKey) ?? tabs[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(920px,96vw)] max-w-none gap-0 border border-slate-300 bg-white p-0 text-slate-900">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base font-semibold">Products</DialogTitle>
          <DialogDescription className="sr-only">
            Browse products by tab and choose a symbol-source pair.
          </DialogDescription>
        </DialogHeader>

        <div className="px-3 pb-3">
          <div className="mb-2 inline-flex rounded-md border border-slate-300 bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTabKey(tab.key)}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  activeTab.key === tab.key
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
                <span className="ml-1 text-[10px] text-slate-500">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-md border border-slate-300">
            <div
              className="grid items-center border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
              style={{ gridTemplateColumns: gridTemplateForTab(activeTab) }}
            >
              {activeTab.columns.map((column) => (
                <span key={column.key}>{column.label}</span>
              ))}
            </div>

            <div className="max-h-[380px] overflow-auto bg-white">
              {activeTab.rows.map((row) => {
                const selected = row.displaySymbol.toUpperCase() === currentSymbol.toUpperCase() && row.source.toUpperCase() === currentSource.toUpperCase();

                return (
                  <div
                    key={row.id}
                    onClick={() => {
                      onSelect(row);
                      onOpenChange(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(row);
                        onOpenChange(false);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`group grid w-full cursor-pointer items-center border-b border-slate-100 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-slate-50 ${
                      selected ? "bg-slate-100" : ""
                    }`}
                    style={{ gridTemplateColumns: gridTemplateForTab(activeTab) }}
                  >
                    {activeTab.columns.map((column) => {
                      if (column.key === "symbol") {
                        return <span key={column.key} className="font-medium text-slate-900">{row.displaySymbol}</span>;
                      }

                      if (column.key === "description") {
                        return (
                          <span key={column.key} className="truncate text-slate-600">
                            {row.description || "\u2014"}
                          </span>
                        );
                      }

                      if (column.key === "isin") {
                        return (
                          <span key={column.key} className="inline-flex items-center gap-1.5 text-slate-600">
                            <span>{row.isin || "\u2014"}</span>
                            {row.isin ? (
                              <span className="opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  title="Copy ISIN"
                                  className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-slate-200"
                                  onClick={async (event) => {
                                    event.stopPropagation();
                                    const ok = await copyText(row.isin as string);
                                    if (ok) toast.success("Copied");
                                    else toast.error("Copy failed");
                                  }}
                                >
                                  <IsinCopyIcon />
                                </button>
                              </span>
                            ) : null}
                          </span>
                        );
                      }

                      if (column.key === "source") {
                        return (
                          <span key={column.key} className="inline-flex items-center gap-1.5 text-slate-700">
                            <SourceBadge source={row.source} />
                            <span>{row.source}</span>
                          </span>
                        );
                      }

                      return null;
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
            <Copy className="h-3.5 w-3.5" />
            {assetClass === "stocks"
              ? "ISIN copy icon appears on row hover in Stocks tab only."
              : "Crypto products do not support ISIN copy behavior."}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
