const BLOCKED_DOMAINS = new Set([
  "wikipedia.org", "wikidata.org", "facebook.com", "twitter.com", "x.com",
  "linkedin.com", "instagram.com", "youtube.com", "reddit.com", "github.com",
  "bloomberg.com", "reuters.com", "yahoo.com", "google.com", "bing.com",
  "forbes.com", "cnbc.com", "marketwatch.com", "investopedia.com",
  "crunchbase.com", "glassdoor.com", "indeed.com", "yelp.com",
  "amazon.com", "ebay.com", "walmart.com", "apple.com", "microsoft.com",
  "sec.gov", "finra.org", "nseindia.com", "bseindia.com",
  "tradingview.com", "coinmarketcap.com", "coingecko.com",
  "moneycontrol.com", "screener.in", "trendlyne.com",
]);

const NOISE_DOMAINS = new Set([
  "news", "wiki", "blog", "forum", "review", "reviews", "compare",
  "versus", "alternative", "alternatives", "best", "top10",
]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|inc\.?|corp\.?|corporation|plc|company|co\.?|holdings|group|enterprises?|llc)\b/gi, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export function scoreDomain(companyName: string, domain: string): number {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, "");
  if (BLOCKED_DOMAINS.has(cleanDomain)) return 0;

  const domainRoot = cleanDomain.split(".")[0] || "";
  for (const noise of NOISE_DOMAINS) { if (domainRoot.includes(noise)) return 0; }

  const tokens = tokenize(companyName);
  const joined = normalize(companyName);
  const normalizedRoot = normalize(domainRoot);

  if (!normalizedRoot || normalizedRoot.length < 2) return 0;

  let score = 0;

  if (normalizedRoot === joined) score += 0.6;
  else if (joined.length >= 5 && normalizedRoot.includes(joined.slice(0, 5))) score += 0.4;
  else if (joined.length >= 3 && normalizedRoot.includes(joined.slice(0, 3))) score += 0.2;

  const matchedTokens = tokens.filter((t) => t.length >= 3 && (normalizedRoot.includes(t) || t.includes(normalizedRoot)));
  if (matchedTokens.length > 0) score += Math.min(0.3, matchedTokens.length * 0.15);

  if (cleanDomain.endsWith(".com")) score += 0.1;
  else if (cleanDomain.endsWith(".io") || cleanDomain.endsWith(".co")) score += 0.05;

  if (domainRoot.length > 30) score -= 0.1;

  return Math.max(0, Math.min(1, score));
}

export function pickBestDomain(companyName: string, candidates: string[], minScore = 0.35): string | null {
  let best: { domain: string; score: number } | null = null;

  for (const candidate of candidates) {
    let domain = candidate;
    try { domain = new URL(candidate).hostname.replace(/^www\./, ""); } catch { domain = candidate.replace(/^www\./, ""); }

    const s = scoreDomain(companyName, domain);
    if (s >= minScore && (!best || s > best.score)) best = { domain, score: s };
  }

  return best?.domain || null;
}