interface MarketClosedIconProps {
  className?: string;
}

/**
 * Market Closed indicator icon — matches TradingView's closed-session dash.
 * A centered horizontal rectangle dash inside a 24×24 viewBox.
 */
export default function MarketClosedIcon({ className = "h-3.5 w-3.5" }: MarketClosedIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.5" y="10.5" width="19" height="3" rx="1.5" />
    </svg>
  );
}
