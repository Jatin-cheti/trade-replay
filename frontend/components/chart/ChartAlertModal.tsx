import { createPortal } from "react-dom";
import { useState } from "react";
import { X } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

interface ChartAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  cursorPrice: number | null;
}

const CONDITIONS = [
  "Crossing",
  "Crossing Up",
  "Crossing Down",
  "Greater Than",
  "Less Than",
  "% Change",
] as const;

export default function ChartAlertModal({
  open,
  onOpenChange,
  symbol,
  cursorPrice,
}: ChartAlertModalProps) {
  const [condition, setCondition] = useState<string>("Crossing");
  const [price, setPrice] = useState<string>(() => (cursorPrice ?? 0).toFixed(2));
  const [message, setMessage] = useState<string>(`Alert on ${symbol}`);
  const [submitting, setSubmitting] = useState(false);

  // Update price when cursorPrice changes and modal opens
  useState(() => {
    if (cursorPrice != null) setPrice(cursorPrice.toFixed(2));
  });

  if (!open) return null;

  async function handleCreate() {
    setSubmitting(true);
    try {
      await axios.post("/api/alerts", {
        symbol,
        condition,
        price: parseFloat(price),
        message,
      });
      toast.success(`Alert created for ${symbol} at ${price}`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to create alert");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <div
      data-testid="chart-alert-modal"
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div className="w-[360px] rounded-xl border border-primary/25 bg-background shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-3">
          <span className="text-sm font-semibold text-foreground">Create Alert · {symbol}</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Condition
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary/50"
            >
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Price
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              step="0.01"
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-[12px] tabular-nums text-foreground outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Message
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border/30 px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md px-4 py-1.5 text-[12px] text-muted-foreground hover:bg-primary/10 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting}
            className="rounded-md bg-primary/20 px-4 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/30 transition disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Alert"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
