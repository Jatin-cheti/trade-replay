/**
 * companyNormalizer.service.ts — Normalize company names to derive domains for Clearbit.
 *
 * Handles edge cases: Indian stocks (Ltd, Industries, Group), ETFs, bonds, etc.
 */

const STRIP_SUFFIXES = /\b(ltd|limited|inc|incorporated|corp|corporation|co|company|plc|ag|sa|se|nv|bv|gmbh|llc|lp|industries|industry|group|holdings|holding|enterprises|enterprise|international|intl|global|services|solutions|technologies|technology|tech|systems|pharma|pharmaceuticals|infra|infrastructure|logistics|capital|financial|finance|bancorp|bank|insurance|assurance|realty|properties|land|development|manufacturing|mfg|chemicals|chemical|textiles|textile|metals|metal|power|energy|oil|gas|petroleum|construction|engineering|steel|cement|foods|food|beverages|minerals|mining|investments|investors|associates|partners|ventures)\b/gi;

const STRIP_PATTERNS = [
  /[^\w\s-]/g,         // remove special chars except hyphens
  /\s+/g,              // collapse whitespace
];

/** Well-known company name → domain overrides (Indian + global edge cases) */
const NAME_DOMAIN_MAP: Record<string, string> = {
  "hdfc life": "hdfclife.com",
  "hdfc bank": "hdfcbank.com",
  "hdfc": "hdfc.com",
  "icici bank": "icicibank.com",
  "icici prudential": "iciciprulife.com",
  "sbi": "sbi.co.in",
  "sbi life": "sbilife.co.in",
  "reliance": "ril.com",
  "tata motors": "tatamotors.com",
  "tata steel": "tatasteel.com",
  "tata consultancy": "tcs.com",
  "tcs": "tcs.com",
  "infosys": "infosys.com",
  "wipro": "wipro.com",
  "bajaj finance": "bajajfinserv.in",
  "mahindra": "mahindra.com",
  "bharti airtel": "airtel.in",
  "airtel": "airtel.in",
  "kotak mahindra": "kotak.com",
  "asian paints": "asianpaints.com",
  "ultratech": "ultratechcement.com",
  "sun pharma": "sunpharma.com",
  "dr reddys": "drreddys.com",
  "cipla": "cipla.com",
  "maruti suzuki": "marutisuzuki.com",
  "hero motocorp": "heromotocorp.com",
  "bajaj auto": "bajajauto.com",
  "nestle india": "nestle.in",
  "hindustan unilever": "hul.co.in",
  "itc": "itcportal.com",
  "larsen toubro": "larsentoubro.com",
  "axis bank": "axisbank.com",
  "adani": "adani.com",
  "power grid": "powergrid.in",
  "ntpc": "ntpc.co.in",
  "ongc": "ongcindia.com",
  "coal india": "coalindia.in",
  "grasim": "grasim.com",
  "dhunseri": "dhunseri.com",
  "tarachand": "tarachand.com",
  // Global large caps
  "apple": "apple.com",
  "microsoft": "microsoft.com",
  "google": "google.com",
  "alphabet": "abc.xyz",
  "amazon": "amazon.com",
  "meta platforms": "meta.com",
  "facebook": "meta.com",
  "tesla": "tesla.com",
  "nvidia": "nvidia.com",
  "berkshire hathaway": "berkshirehathaway.com",
  "johnson johnson": "jnj.com",
  "jpmorgan": "jpmorganchase.com",
  "visa": "visa.com",
  "mastercard": "mastercard.com",
  "walmart": "walmart.com",
  "procter gamble": "pg.com",
  "exxon mobil": "exxonmobil.com",
  "chevron": "chevron.com",
  "pfizer": "pfizer.com",
  "disney": "disney.com",
  "coca cola": "coca-cola.com",
  "pepsi": "pepsico.com",
};

/**
 * Normalize a company name: strip suffixes, lowercase, trim.
 */
export function normalizeName(name: string): string {
  let n = name.toLowerCase().trim();
  n = n.replace(STRIP_SUFFIXES, "");
  for (const pat of STRIP_PATTERNS) {
    n = n.replace(pat, " ");
  }
  return n.trim().replace(/\s+/g, " ");
}

/**
 * Try to derive a domain from a company name.
 * Returns domain string or null.
 */
export function deriveDomain(name: string): string | null {
  const normalized = normalizeName(name);
  if (!normalized || normalized.length < 2) return null;

  // Check known overrides first (substring match — "HDFC Life Insurance Company Limited" → "hdfc life")
  for (const [key, domain] of Object.entries(NAME_DOMAIN_MAP)) {
    if (normalized.includes(key)) return domain;
  }

  // Generate guessed domain: first meaningful word(s) + .com
  const words = normalized.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return null;

  // Try first two words joined, then just first word
  if (words.length >= 2) {
    const two = words.slice(0, 2).join("").replace(/[^a-z0-9]/g, "");
    if (two.length >= 3) return `${two}.com`;
  }
  const one = words[0].replace(/[^a-z0-9]/g, "");
  if (one.length >= 3) return `${one}.com`;

  return null;
}
