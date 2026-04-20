import { flagEmojiToCountryCode } from "@/lib/screener";

export default function CountryFlagImg({ code, size = 16, className = "" }: { code: string; size?: number; className?: string }) {
  if (!code || code === "WORLD" || code === "OTHER") {
    return (
      <img
        src="https://flagcdn.com/w40/un.png"
        srcSet="https://flagcdn.com/w80/un.png 2x"
        alt="World"
        width={size}
        height={Math.round(size * 0.75)}
        className={`inline-block rounded-[2px] object-cover ${className}`}
        style={{ width: size, height: Math.round(size * 0.75), minWidth: size }}
        loading="lazy"
      />
    );
  }

  let cc = code;
  if (code.length > 2) {
    const decoded = flagEmojiToCountryCode(code);
    if (decoded) {
      cc = decoded;
    } else {
      return <span className="inline-flex items-center justify-center" style={{ width: size, height: size }} />;
    }
  }
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/w40/${cc.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w80/${cc.toLowerCase()}.png 2x`}
      alt={cc}
      width={size}
      height={h}
      className={`inline-block rounded-[2px] object-cover ${className}`}
      style={{ width: size, height: h, minWidth: size }}
      loading="lazy"
    />
  );
}
