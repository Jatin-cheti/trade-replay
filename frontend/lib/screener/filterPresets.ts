// Preset configurations for screener range/date filters.
// Keyed by filter field key. Each preset produces a {min,max} or {from,to}.

export interface RangePreset {
  label: string;
  min?: number;
  max?: number;
}

export interface DatePreset {
  label: string;
  // offset in days from today; negative = past, positive = future
  fromDaysFromToday?: number;
  toDaysFromToday?: number;
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function resolveDatePreset(preset: DatePreset): { from?: string; to?: string } {
  return {
    from: preset.fromDaysFromToday !== undefined ? isoDate(preset.fromDaysFromToday) : undefined,
    to: preset.toDaysFromToday !== undefined ? isoDate(preset.toDaysFromToday) : undefined,
  };
}

export const RANGE_PRESETS: Record<string, RangePreset[]> = {
  price: [
    { label: "Under $5", max: 5 },
    { label: "$5–$20", min: 5, max: 20 },
    { label: "$20–$100", min: 20, max: 100 },
    { label: "$100–$500", min: 100, max: 500 },
    { label: "$500+", min: 500 },
  ],
  changePercent: [
    { label: "Gainers >5%", min: 5 },
    { label: "Gainers >2%", min: 2 },
    { label: "Flat ±1%", min: -1, max: 1 },
    { label: "Losers <-2%", max: -2 },
    { label: "Losers <-5%", max: -5 },
  ],
  marketCap: [
    { label: "Mega ($200B+)", min: 200_000_000_000 },
    { label: "Large ($10B–$200B)", min: 10_000_000_000, max: 200_000_000_000 },
    { label: "Mid ($2B–$10B)", min: 2_000_000_000, max: 10_000_000_000 },
    { label: "Small ($300M–$2B)", min: 300_000_000, max: 2_000_000_000 },
    { label: "Micro (<$300M)", max: 300_000_000 },
  ],
  volume: [
    { label: "1M+", min: 1_000_000 },
    { label: "10M+", min: 10_000_000 },
    { label: "100M+", min: 100_000_000 },
  ],
  relVolume: [
    { label: "Above avg (>1.5)", min: 1.5 },
    { label: "Heavy (>3)", min: 3 },
    { label: "Extreme (>5)", min: 5 },
  ],
  pe: [
    { label: "Under 15", max: 15 },
    { label: "15–25", min: 15, max: 25 },
    { label: "25–50", min: 25, max: 50 },
    { label: "50+", min: 50 },
  ],
  peg: [
    { label: "Under 1 (undervalued)", max: 1 },
    { label: "1–2", min: 1, max: 2 },
    { label: "2+", min: 2 },
  ],
  divYieldPercent: [
    { label: "Any dividend", min: 0.01 },
    { label: ">2%", min: 2 },
    { label: ">4%", min: 4 },
    { label: ">6%", min: 6 },
  ],
  roe: [
    { label: ">15%", min: 15 },
    { label: ">25%", min: 25 },
  ],
  beta: [
    { label: "Low (<0.8)", max: 0.8 },
    { label: "Market (0.8–1.2)", min: 0.8, max: 1.2 },
    { label: "High (>1.2)", min: 1.2 },
  ],
  revenueGrowth: [
    { label: ">10%", min: 10 },
    { label: ">25%", min: 25 },
    { label: ">50%", min: 50 },
  ],
  epsDilGrowth: [
    { label: ">10%", min: 10 },
    { label: ">25%", min: 25 },
  ],
  perfPercent: [
    { label: ">10%", min: 10 },
    { label: "Negative", max: 0 },
  ],
};

export const DATE_PRESETS: Record<string, DatePreset[]> = {
  recentEarningsDate: [
    { label: "Past week", fromDaysFromToday: -7, toDaysFromToday: 0 },
    { label: "Past 30 days", fromDaysFromToday: -30, toDaysFromToday: 0 },
    { label: "Past 90 days", fromDaysFromToday: -90, toDaysFromToday: 0 },
  ],
  upcomingEarningsDate: [
    { label: "Today", fromDaysFromToday: 0, toDaysFromToday: 0 },
    { label: "Tomorrow", fromDaysFromToday: 1, toDaysFromToday: 1 },
    { label: "This week", fromDaysFromToday: 0, toDaysFromToday: 7 },
    { label: "Next week", fromDaysFromToday: 7, toDaysFromToday: 14 },
    { label: "Next 30 days", fromDaysFromToday: 0, toDaysFromToday: 30 },
  ],
};

export const ANALYST_RATING_OPTIONS = [
  { value: "strong-buy", label: "Strong Buy" },
  { value: "buy", label: "Buy" },
  { value: "hold", label: "Hold" },
  { value: "sell", label: "Sell" },
  { value: "strong-sell", label: "Strong Sell" },
];

export const SECTOR_OPTIONS = [
  { value: "Technology", label: "Technology" },
  { value: "Financial Services", label: "Financial Services" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Consumer Cyclical", label: "Consumer Cyclical" },
  { value: "Communication Services", label: "Communication Services" },
  { value: "Industrials", label: "Industrials" },
  { value: "Consumer Defensive", label: "Consumer Defensive" },
  { value: "Energy", label: "Energy" },
  { value: "Utilities", label: "Utilities" },
  { value: "Real Estate", label: "Real Estate" },
  { value: "Basic Materials", label: "Basic Materials" },
];
