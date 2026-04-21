interface PrimaryListingIconProps {
  className?: string;
  title?: string;
}

/**
 * Primary Listing icon — a mountain/chart shape indicating the primary listing exchange.
 * Matches TradingView's primary listing indicator.
 */
export default function PrimaryListingIcon({ className = "h-4 w-4", title }: PrimaryListingIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path
        opacity="0.15"
        d="M4 16V5L8 9L12 5L16 9L20 5V16H4Z"
        fill="currentColor"
      />
      <path
        d="M4 19H20M4 5V16H20V5L16 9L12 5L8 9L4 5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
