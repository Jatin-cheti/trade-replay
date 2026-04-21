import { useEffect, useState } from "react";

interface AssetAvatarProps {
  src?: string | null;
  label: string;
  className?: string;
  imgClassName?: string;
}

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

// Only truly dead providers — DNS dead or always 401/403
function isDeadProvider(url: string): boolean {
  return (
    url.includes("logo.clearbit.com") ||
    url.includes("img.logo.dev") ||
    url.includes("ui-avatars.com") ||
    url.includes("logo.uplead.com")
  );
}

function isUsableSrc(src?: string | null): boolean {
  if (!src || typeof src !== "string") return false;
  if (src.startsWith("data:")) return true;
  if (!src.startsWith("http")) return false;
  if (isDeadProvider(src)) return false;
  return true;
}

function buildSrcSet(_src?: string): string {
  return "";
}

export { buildSrcSet, hashColor, deriveInitials };

export default function AssetAvatar({ src, label, className, imgClassName }: AssetAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  const sizeClasses = (imgClassName ?? className ?? "h-8 w-8 rounded-full").trim();

  if (!isUsableSrc(src) || failed) {
    return (
      <span
        role="img"
        aria-label={label}
        data-initials-fallback="true"
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden text-[11px] font-bold text-white ${sizeClasses}`}
        style={{ backgroundColor: hashColor(label || "?") }}
      >
        {deriveInitials(label)}
      </span>
    );
  }

  return (
    <img
      src={src as string}
      alt={label}
      title={label}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={`shrink-0 object-contain bg-white/10 ${sizeClasses}`}
      onError={() => setFailed(true)}
    />
  );
}