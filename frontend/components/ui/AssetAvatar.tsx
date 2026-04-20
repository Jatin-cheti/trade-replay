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

  const displaySrc = imageFailed ? fallbackIcon : currentSrc;
  const initials = label.slice(0, 2).toUpperCase();

  if (svgFailed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-primary/40 to-primary/20 text-xs font-bold text-primary ${containerClasses}`}>
        {initials}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center p-[3px] ${containerClasses}`}>
      <img
        src={displaySrc}
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
