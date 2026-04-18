import { useEffect, useMemo, useState } from "react";

interface AssetAvatarProps {
  src?: string;
  label: string;
  className?: string;
  imgClassName?: string;
}

function normalizeAvatarClasses(input?: string): string {
  const base = input?.trim() || "h-5 w-5 rounded-full object-cover ring-1 ring-border/70";
  const withoutCover = base.replace(/\bobject-cover\b/g, "").replace(/\s+/g, " ").trim();
  const hasContain = /\bobject-contain\b/.test(withoutCover);
  const hasBackground = /\bbg-/.test(withoutCover);
  const hasPadding = /\bp-/.test(withoutCover);

  return [
    withoutCover,
    hasContain ? "" : "object-contain",
    hasBackground ? "" : "bg-white/90",
    hasPadding ? "" : "p-1",
  ]
    .filter(Boolean)
    .join(" ");
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
  if (domain) {
    const encoded = encodeURIComponent(domain);
    return [
      src,
      `https://www.google.com/s2/favicons?sz=128&domain=${encoded}`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    ];
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
  const normalizedClassName = useMemo(
    () => normalizeAvatarClasses(imgClassName ?? className),
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
      <div className={`flex items-center justify-center bg-gradient-to-br from-primary/40 to-primary/20 text-xs font-bold text-primary ${normalizedClassName}`}>
        {initials}
      </div>
    );
  }

  return (
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
      className={normalizedClassName}
    />
  );
}
