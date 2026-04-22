import { createPortal } from "react-dom";
import { useState } from "react";
import { X } from "lucide-react";

interface ChartSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
}

type SettingsTab = "Chart" | "Scales" | "Appearance" | "Trading";
const TABS: SettingsTab[] = ["Chart", "Scales", "Appearance", "Trading"];

export default function ChartSettingsModal({
  open,
  onOpenChange,
  symbol,
}: ChartSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("Chart");
  const [showVolume, setShowVolume] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showPrevClose, setShowPrevClose] = useState(true);
  const [candleBody, setCandleBody] = useState(true);
  const [wicksOnly, setWicksOnly] = useState(false);
  const [rightScaleLabels, setRightScaleLabels] = useState(true);
  const [invertScale, setInvertScale] = useState(false);
  const [logarithmicScale, setLogarithmicScale] = useState(false);
  const [percentageScale, setPercentageScale] = useState(false);
  const [background, setBackground] = useState("dark");
  const [fontFamily, setFontFamily] = useState("JetBrains Mono");

  if (!open) return null;

  function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-primary/70" : "bg-border/60"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? "left-[18px]" : "left-0.5"}`}
        />
      </button>
    );
  }

  function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
        <span className="text-[12px] text-foreground">{label}</span>
        {children}
      </div>
    );
  }

  const modal = (
    <div
      data-testid="chart-settings-modal"
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div className="w-[480px] rounded-xl border border-primary/25 bg-background shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-3">
          <div>
            <span className="text-sm font-semibold text-foreground">Chart Settings</span>
            <span className="ml-2 text-[11px] text-muted-foreground">· {symbol}</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/30">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-[12px] font-semibold transition ${
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-1 min-h-[240px]">
          {activeTab === "Chart" && (
            <>
              <Row label="Show volume"><Toggle value={showVolume} onChange={setShowVolume} /></Row>
              <Row label="Show previous close"><Toggle value={showPrevClose} onChange={setShowPrevClose} /></Row>
              <Row label="Show grid"><Toggle value={showGrid} onChange={setShowGrid} /></Row>
              <Row label="Candle body"><Toggle value={candleBody} onChange={setCandleBody} /></Row>
              <Row label="Wicks only"><Toggle value={wicksOnly} onChange={setWicksOnly} /></Row>
            </>
          )}
          {activeTab === "Scales" && (
            <>
              <Row label="Right scale labels"><Toggle value={rightScaleLabels} onChange={setRightScaleLabels} /></Row>
              <Row label="Invert scale"><Toggle value={invertScale} onChange={setInvertScale} /></Row>
              <Row label="Logarithmic scale"><Toggle value={logarithmicScale} onChange={setLogarithmicScale} /></Row>
              <Row label="Percentage scale"><Toggle value={percentageScale} onChange={setPercentageScale} /></Row>
            </>
          )}
          {activeTab === "Appearance" && (
            <>
              <Row label="Background">
                <div className="flex gap-2">
                  {["dark", "light", "midnight"].map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setBackground(bg)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition capitalize ${
                        background === bg ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-primary/10"
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Font family">
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="rounded-md border border-border/50 bg-background px-2 py-1 text-[11px] text-foreground outline-none"
                >
                  <option>JetBrains Mono</option>
                  <option>Inter</option>
                  <option>Roboto Mono</option>
                </select>
              </Row>
            </>
          )}
          {activeTab === "Trading" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="text-[13px] font-semibold text-foreground mb-1">Trading settings</span>
              <span className="text-[12px] text-muted-foreground">Connect a broker to configure trading settings.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border/30 px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md px-4 py-1.5 text-[12px] text-muted-foreground hover:bg-primary/10 hover:text-foreground transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md bg-primary/20 px-4 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/30 transition"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
