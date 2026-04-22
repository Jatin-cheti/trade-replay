import {
  List,
  SlidersHorizontal,
  Star,
  Bell,
  HelpCircle,
} from "lucide-react";

interface ChartRightMiniStripProps {
  onObjectTree: () => void;
  onSettings: () => void;
  onWatchlist: () => void;
  onAlerts: () => void;
  onHelp?: () => void;
}

const STRIP_ITEMS = [
  { id: "objectTree", Icon: List, label: "Object tree", testId: "strip-object-tree" },
  { id: "settings", Icon: SlidersHorizontal, label: "Settings", testId: "strip-settings" },
  { id: "watchlist", Icon: Star, label: "Watchlist", testId: "strip-watchlist" },
  { id: "alerts", Icon: Bell, label: "Alerts", testId: "strip-alerts" },
  { id: "help", Icon: HelpCircle, label: "Help", testId: "strip-help" },
] as const;

type StripId = (typeof STRIP_ITEMS)[number]["id"];

export default function ChartRightMiniStrip({
  onObjectTree,
  onSettings,
  onWatchlist,
  onAlerts,
  onHelp,
}: ChartRightMiniStripProps) {
  const handlers: Record<StripId, (() => void) | undefined> = {
    objectTree: onObjectTree,
    settings: onSettings,
    watchlist: onWatchlist,
    alerts: onAlerts,
    help: onHelp,
  };

  return (
    <div
      data-testid="chart-right-mini-strip"
      className="absolute right-0 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-l-xl border border-r-0 border-primary/15 bg-background/85 py-2 px-1 backdrop-blur-xl shadow-lg"
    >
      {STRIP_ITEMS.map(({ id, Icon, label, testId }) => (
        <button
          key={id}
          type="button"
          data-testid={testId}
          title={label}
          onClick={handlers[id]}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-foreground active:bg-primary/20 active:text-primary"
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
