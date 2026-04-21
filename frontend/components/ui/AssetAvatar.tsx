import { useEffect, useMemo, useState } from "react";

interface AssetAvatarProps {
  src?: string;
  label: string;
  className?: string;
  imgClassName?: string;
}

/** Extract size classes (h-X w-X) and ring/border classes from input, split into container vs img concerns */
function parseAvatarClasses(input?: string): { containerClasses: string; imgClasses: string } {
  const base = input?.trim() || "h-5 w-5 rounded-full ring-1 ring-border/70";

  // Remove object-cover (we always use object-contain)
  const cleaned = base.replace(/\bobject-cover\b/g, "").replace(/\s+/g, " ").trim();

  // Container gets: size (h-X w-X), shape (rounded-*), ring/border, background, shrink, overflow
  // Image gets: object-contain only (fills 100% of container with padding applied to container)
  const tokens = cleaned.split(" ");
  const containerTokens: string[] = [];

  for (const t of tokens) {
    // Skip object-* and p-* (we handle these ourselves)
    if (t.startsWith("object-") || /^p-/.test(t) || /^p[xytblr]-/.test(t)) continue;
    containerTokens.push(t);
  }

  // Ensure container has background and overflow-hidden
  if (!containerTokens.some(t => t.startsWith("bg-"))) containerTokens.push("bg-white/90");
  if (!containerTokens.includes("overflow-hidden")) containerTokens.push("overflow-hidden");

  return {
    containerClasses: containerTokens.join(" "),
    imgClasses: "object-contain",
  };
}

function extractDomainFromClearbitUrl(src: string): string | null {
  const marker = "logo.clearbit.com/";
  const markerIndex = src.indexOf(marker);
  if (markerIndex === -1) return null;

  const afterMarker = src.slice(markerIndex + marker.length);
  const domain = afterMarker.split("?")[0]?.trim();
  if (!domain) return null;
  return domain;
}

function extractDomainFromGoogleFavicon(src: string): string | null {
  const match = src.match(/[?&]domain=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function extractDomainFromLogoDevUrl(src: string): string | null {
  const match = src.match(/img\.logo\.dev\/([^?/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function buildImageCandidates(src?: string): string[] {
  if (!src) return [];

  // Data URIs (generated SVGs) — use directly, no fallback chain needed
  if (src.startsWith("data:")) return [src];

  // Extract domain only from known logo-service URLs
  let domain: string | null = null;

  const clearbitDomain = extractDomainFromClearbitUrl(src);
  if (clearbitDomain) domain = clearbitDomain;

  if (!domain) {
    const googleDomain = extractDomainFromGoogleFavicon(src);
    if (googleDomain) domain = googleDomain;
  }

  if (!domain) {
    const logoDevDomain = extractDomainFromLogoDevUrl(src);
    if (logoDevDomain) domain = logoDevDomain;
  }

  // If domain was extracted from a logo service, build a fallback chain
  // Skip known-dead providers (Clearbit DNS down, logo.dev ORB blocked) and go straight to stable
  if (domain) {
    const encoded = encodeURIComponent(domain);
    const isDeadProvider =
      src.includes("logo.clearbit.com") || src.includes("img.logo.dev");

    if (isDeadProvider) {
      // Skip the dead primary, go straight to Google Favicon
      return [
        `https://www.google.com/s2/favicons?sz=128&domain=${encoded}`,
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      ];
    }

    return [
      src,
      `https://www.google.com/s2/favicons?sz=128&domain=${encoded}`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    ];
  }

  // For FMP image-stock URLs, add Google favicon as fallback
  if (src.includes("financialmodelingprep.com/image-stock/")) {
    return [src];
  }

  // For direct image URLs (CloudFront, S3, etc.), use as-is
  return [src];
}

/**
 * Loop 3 LOGO-005 — build an `srcset` for HiDPI displays when the source CDN
 * supports a size parameter. SVG and data URIs are resolution-independent, so
 * we deliberately skip srcset for them (returns empty string => no srcset attr).
 */
function buildSrcSet(src: string): string {
  if (!src || src.startsWith("data:")) return "";
  if (/\.svg(\?|$)/i.test(src)) return "";

  // Google Favicons — supports `sz` query param
  if (src.includes("www.google.com/s2/favicons")) {
    const url = new URL(src);
    const base = `${url.origin}${url.pathname}`;
    const domain = url.searchParams.get("domain") ?? "";
    const enc = encodeURIComponent(domain);
    return [
      `${base}?sz=64&domain=${enc} 1x`,
      `${base}?sz=128&domain=${enc} 2x`,
      `${base}?sz=256&domain=${enc} 3x`,
    ].join(", ");
  }

  // Clearbit — supports `size` param (kept even though provider is flaky; preserves
  // srcset semantics if operators re-enable it).
  if (src.includes("logo.clearbit.com")) {
    const [base] = src.split("?");
    return [
      `${base}?size=64 1x`,
      `${base}?size=128 2x`,
      `${base}?size=256 3x`,
    ].join(", ");
  }

  // Logo.dev — `?size=` param
  if (src.includes("img.logo.dev")) {
    const [base] = src.split("?");
    return [
      `${base}?size=64 1x`,
      `${base}?size=128 2x`,
      `${base}?size=256 3x`,
    ].join(", ");
  }

  // S3 / CloudFront assets: if the filename encodes size (…/sz-256/logo.png),
  // emit 1x/2x variants by swapping the size segment. This matches our
  // logo-service output where sz=128 and sz=256 variants coexist.
  const szMatch = src.match(/(\/|_)(sz-?)(128|256)(\/|_|\.)/i);
  if (szMatch) {
    const at64 = src.replace(szMatch[0], `${szMatch[1]}${szMatch[2]}64${szMatch[4]}`);
    const at128 = src.replace(szMatch[0], `${szMatch[1]}${szMatch[2]}128${szMatch[4]}`);
    const at256 = src.replace(szMatch[0], `${szMatch[1]}${szMatch[2]}256${szMatch[4]}`);
    return [`${at64} 1x`, `${at128} 2x`, `${at256} 3x`].join(", ");
  }

  return "";
}

export { buildSrcSet };

const AVATAR_PALETTE = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
  "#EF4444", "#6366F1", "#EC4899", "#14B8A6",
  "#F97316", "#84CC16", "#06B6D4", "#A855F7",
];

function hashColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = label.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function deriveInitials(label: string): string {
  const cleaned = (label || "?").replace(/[^A-Za-z0-9\s]/g, "").trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

export default function AssetAvatar({ src, label, className, imgClassName }: AssetAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [svgFailed, setSvgFailed] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const imageCandidates = useMemo(() => buildImageCandidates(src), [src]);
  const fallbackIcon = "/icons/exchange/default.svg";
  const currentSrc = imageCandidates[candidateIndex] || fallbackIcon;
  const { containerClasses, imgClasses } = useMemo(
    () => parseAvatarClasses(imgClassName ?? className),
    [imgClassName, className],
  );

  useEffect(() => {
    setImageFailed(false);
    setSvgFailed(false);
    setCandidateIndex(0);
  }, [src]);

  const hasValidSrc = imageCandidates.length > 0;
  const displaySrc = imageFailed ? fallbackIcon : currentSrc;
  const initials = deriveInitials(label);
  const bgColor = hashColor(label || "?");

  // No src at all, or final fallback SVG failed → colored initials badge (never grey square)
  if (!hasValidSrc || svgFailed) {
    return (
      <div
        role="img"
        aria-label={label}
        className={`flex items-center justify-center text-[11px] font-bold text-white ${containerClasses}`}
        style={{ backgroundColor: bgColor }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center p-[3px] ${containerClasses}`}>
      <img
        src={displaySrc}
        srcSet={buildSrcSet(displaySrc) || undefined}
        sizes="64px"
        alt={label}
        title={label}
        loading="lazy"
        onError={() => {
          if (candidateIndex < imageCandidates.length - 1) {
            setCandidateIndex((index) => index + 1);
            return;
          }
          if (displaySrc !== fallbackIcon) {
            setImageFailed(true);
            return;
          }
          setSvgFailed(true);
        }}
        referrerPolicy="no-referrer"
        className={`w-full h-full ${imgClasses}`}
      />
    </div>
  );
}
