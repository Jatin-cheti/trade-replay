/**
 * companyNormalizer.service.ts — Normalize company names to derive domains for Clearbit.
 *
 * Enhanced with:
 * - 200+ known company->domain mappings (Indian + US + Global)
 * - Multi-candidate domain generation with confidence scoring
 * - Country-specific TLD hints
 * - Better suffix/prefix stripping
 */

const STRIP_SUFFIXES = /\b(ltd|limited|inc|incorporated|corp|corporation|co|company|plc|ag|sa|se|nv|bv|gmbh|llc|lp|industries|industry|group|holdings|holding|enterprises|enterprise|international|intl|global|services|solutions|technologies|technology|tech|systems|pharma|pharmaceuticals|infra|infrastructure|logistics|capital|financial|finance|bancorp|bank|insurance|assurance|realty|properties|land|development|manufacturing|mfg|chemicals|chemical|textiles|textile|metals|metal|power|energy|oil|gas|petroleum|construction|engineering|steel|cement|foods|food|beverages|minerals|mining|investments|investors|associates|partners|ventures|brands|stores|acquisition|merger|class\s*[a-z]?|series\s*[a-z]?|common\s*stock|ordinary\s*shares?|preference|preferred|warrant|unit|right|de\s*cv|s\.?a\.?\s*de\s*c\.?v\.?|s\.?a\.?b?\s*de\s*c\.?v\.?|s\.?a\.?|a\.?s\.?|oyj|tbk|berhad|bhd)\b/gi;

const STRIP_PATTERNS = [
  /[^\w\s-]/g,         // remove special chars except hyphens
  /\s+/g,              // collapse whitespace
];

/** Well-known company name -> domain overrides */
const NAME_DOMAIN_MAP: Record<string, string> = {
  // === Indian Large Caps ===
  "hdfc life": "hdfclife.com",
  "hdfc bank": "hdfcbank.com",
  "hdfc": "hdfc.com",
  "icici bank": "icicibank.com",
  "icici prudential": "iciciprulife.com",
  "icici lombard": "icicilombard.com",
  "sbi": "sbi.co.in",
  "sbi life": "sbilife.co.in",
  "sbi cards": "sbicard.com",
  "reliance": "ril.com",
  "tata motors": "tatamotors.com",
  "tata steel": "tatasteel.com",
  "tata consultancy": "tcs.com",
  "tata power": "tatapower.com",
  "tata consumer": "tataconsumer.com",
  "tata chemicals": "tatachemicals.com",
  "tata communications": "tatacommunications.com",
  "tata elxsi": "tataelxsi.com",
  "tcs": "tcs.com",
  "infosys": "infosys.com",
  "wipro": "wipro.com",
  "hcl tech": "hcltech.com",
  "tech mahindra": "techmahindra.com",
  "bajaj finance": "bajajfinserv.in",
  "bajaj finserv": "bajajfinserv.in",
  "bajaj auto": "bajajauto.com",
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
  "nestle india": "nestle.in",
  "hindustan unilever": "hul.co.in",
  "itc": "itcportal.com",
  "larsen toubro": "larsentoubro.com",
  "larsen & toubro": "larsentoubro.com",
  "axis bank": "axisbank.com",
  "adani": "adani.com",
  "adani enterprises": "adani.com",
  "adani ports": "adaniports.com",
  "adani green": "adanigreenenergy.com",
  "adani power": "adanipower.com",
  "adani total": "adanitotalgas.com",
  "power grid": "powergrid.in",
  "ntpc": "ntpc.co.in",
  "ongc": "ongcindia.com",
  "coal india": "coalindia.in",
  "grasim": "grasim.com",
  "dhunseri": "dhunseri.com",
  "tarachand": "tarachand.com",
  "indian oil": "iocl.com",
  "bharat petroleum": "bharatpetroleum.in",
  "bpcl": "bharatpetroleum.in",
  "hindustan petroleum": "hindustanpetroleum.com",
  "hpcl": "hindustanpetroleum.com",
  "vedanta": "vedantalimited.com",
  "jsw steel": "jswsteel.in",
  "jsw energy": "jswenergy.in",
  "divi lab": "divislaboratories.com",
  "divis lab": "divislaboratories.com",
  "pidilite": "pidilite.com",
  "havells": "havells.com",
  "godrej consumer": "godrejcp.com",
  "godrej properties": "godrejproperties.com",
  "britannia": "britannia.co.in",
  "dabur": "dabur.com",
  "marico": "marico.com",
  "indusind bank": "indusind.com",
  "bandhan bank": "bandhanbank.com",
  "federal bank": "federalbank.co.in",
  "yes bank": "yesbank.in",
  "idfc first": "idfcfirstbank.com",
  "au small finance": "aubank.in",
  "titan": "titan.co.in",
  "zomato": "zomato.com",
  "paytm": "paytm.com",
  "nykaa": "nykaa.com",
  "policybazaar": "policybazaar.com",
  "delhivery": "delhivery.com",
  // === US Mega Caps ===
  "apple": "apple.com",
  "microsoft": "microsoft.com",
  "google": "google.com",
  "alphabet": "abc.xyz",
  "amazon": "amazon.com",
  "meta platforms": "meta.com",
  "meta": "meta.com",
  "facebook": "meta.com",
  "tesla": "tesla.com",
  "nvidia": "nvidia.com",
  "berkshire hathaway": "berkshirehathaway.com",
  "johnson johnson": "jnj.com",
  "jpmorgan": "jpmorganchase.com",
  "jp morgan": "jpmorganchase.com",
  "visa": "visa.com",
  "mastercard": "mastercard.com",
  "walmart": "walmart.com",
  "procter gamble": "pg.com",
  "exxon mobil": "exxonmobil.com",
  "exxonmobil": "exxonmobil.com",
  "chevron": "chevron.com",
  "pfizer": "pfizer.com",
  "disney": "disney.com",
  "walt disney": "disney.com",
  "coca cola": "coca-cola.com",
  "pepsi": "pepsico.com",
  "pepsico": "pepsico.com",
  "netflix": "netflix.com",
  "adobe": "adobe.com",
  "salesforce": "salesforce.com",
  "intel": "intel.com",
  "amd": "amd.com",
  "advanced micro": "amd.com",
  "broadcom": "broadcom.com",
  "qualcomm": "qualcomm.com",
  "texas instruments": "ti.com",
  "applied materials": "appliedmaterials.com",
  "lam research": "lamresearch.com",
  "kla": "kla.com",
  "oracle": "oracle.com",
  "cisco": "cisco.com",
  "ibm": "ibm.com",
  "accenture": "accenture.com",
  "paypal": "paypal.com",
  "goldman sachs": "goldmansachs.com",
  "morgan stanley": "morganstanley.com",
  "bank of america": "bankofamerica.com",
  "wells fargo": "wellsfargo.com",
  "citigroup": "citigroup.com",
  "charles schwab": "schwab.com",
  "blackrock": "blackrock.com",
  "vanguard": "vanguard.com",
  "fidelity": "fidelity.com",
  "costco": "costco.com",
  "home depot": "homedepot.com",
  "lowes": "lowes.com",
  "target": "target.com",
  "starbucks": "starbucks.com",
  "mcdonalds": "mcdonalds.com",
  "nike": "nike.com",
  "abbvie": "abbvie.com",
  "eli lilly": "lilly.com",
  "merck": "merck.com",
  "bristol myers": "bms.com",
  "amgen": "amgen.com",
  "gilead": "gilead.com",
  "moderna": "modernatx.com",
  "unitedhealth": "unitedhealthgroup.com",
  "anthem": "antheminc.com",
  "humana": "humana.com",
  "cigna": "cigna.com",
  "caterpillar": "cat.com",
  "deere": "deere.com",
  "john deere": "deere.com",
  "honeywell": "honeywell.com",
  "3m": "3m.com",
  "general electric": "ge.com",
  "raytheon": "rtx.com",
  "lockheed martin": "lockheedmartin.com",
  "boeing": "boeing.com",
  "northrop grumman": "northropgrumman.com",
  "general dynamics": "gd.com",
  "uber": "uber.com",
  "lyft": "lyft.com",
  "airbnb": "airbnb.com",
  "doordash": "doordash.com",
  "snowflake": "snowflake.com",
  "palantir": "palantir.com",
  "crowdstrike": "crowdstrike.com",
  "datadog": "datadoghq.com",
  "cloudflare": "cloudflare.com",
  "twilio": "twilio.com",
  "shopify": "shopify.com",
  "square": "squareup.com",
  "block": "block.xyz",
  "robinhood": "robinhood.com",
  "coinbase": "coinbase.com",
  "zoom": "zoom.us",
  "docusign": "docusign.com",
  "servicenow": "servicenow.com",
  "workday": "workday.com",
  "atlassian": "atlassian.com",
  "autodesk": "autodesk.com",
  "intuit": "intuit.com",
  "spotify": "spotify.com",
  "snap": "snap.com",
  "pinterest": "pinterest.com",
  "twitter": "x.com",
  "dell": "dell.com",
  "hp": "hp.com",
  "hewlett packard": "hpe.com",
  "lenovo": "lenovo.com",
  "micron": "micron.com",
  "western digital": "westerndigital.com",
  "seagate": "seagate.com",
  // === European / Global ===
  "nestle": "nestle.com",
  "novartis": "novartis.com",
  "roche": "roche.com",
  "unilever": "unilever.com",
  "astrazeneca": "astrazeneca.com",
  "glaxosmithkline": "gsk.com",
  "gsk": "gsk.com",
  "hsbc": "hsbc.com",
  "barclays": "barclays.com",
  "lloyds": "lloydsbank.com",
  "shell": "shell.com",
  "bp": "bp.com",
  "totalenergies": "totalenergies.com",
  "siemens": "siemens.com",
  "basf": "basf.com",
  "bayer": "bayer.com",
  "volkswagen": "vw.com",
  "bmw": "bmw.com",
  "mercedes": "mercedes-benz.com",
  "daimler": "mercedes-benz.com",
  "porsche": "porsche.com",
  "sap": "sap.com",
  "lvmh": "lvmh.com",
  "loreal": "loreal.com",
  "hermes": "hermes.com",
  "samsung": "samsung.com",
  "toyota": "toyota.com",
  "sony": "sony.com",
  "softbank": "softbank.com",
  "alibaba": "alibaba.com",
  "tencent": "tencent.com",
  "baidu": "baidu.com",
  "jd com": "jd.com",
  "nio": "nio.com",
  "xpeng": "xpeng.com",
  "byd": "byd.com",
  // === Australian ===
  "commonwealth bank": "commbank.com.au",
  "westpac": "westpac.com.au",
  "anz": "anz.com.au",
  "nab": "nab.com.au",
  "national australia": "nab.com.au",
  "bhp": "bhp.com",
  "rio tinto": "riotinto.com",
  "fortescue": "fmgl.com.au",
  "woodside": "woodside.com",
  "csl": "csl.com",
  // === Canadian ===
  "royal bank of canada": "rbc.com",
  "toronto dominion": "td.com",
  "bank of nova scotia": "scotiabank.com",
  "scotiabank": "scotiabank.com",
  "enbridge": "enbridge.com",
  "suncor": "suncor.com",
  "barrick gold": "barrick.com",
};

/** Country-specific TLD mapping */
const COUNTRY_TLD_MAP: Record<string, string[]> = {
  IN: [".co.in", ".in", ".com"],
  GB: [".co.uk", ".com"],
  AU: [".com.au", ".com"],
  JP: [".co.jp", ".com"],
  DE: [".de", ".com"],
  FR: [".fr", ".com"],
  BR: [".com.br", ".com"],
  CA: [".ca", ".com"],
  CN: [".cn", ".com"],
  KR: [".co.kr", ".com"],
  NZ: [".co.nz", ".com"],
  ZA: [".co.za", ".com"],
  HK: [".com.hk", ".com"],
  SG: [".com.sg", ".com"],
  TW: [".com.tw", ".com"],
  TH: [".co.th", ".com"],
  IL: [".co.il", ".com"],
  SE: [".se", ".com"],
  NO: [".no", ".com"],
  DK: [".dk", ".com"],
  CH: [".ch", ".com"],
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

export interface DomainCandidate {
  domain: string;
  confidence: "high" | "medium" | "low" | "derived";
  method: string;
}

/**
 * Generate multiple domain candidates with confidence scoring.
 */
export function deriveDomainCandidates(name: string, country?: string): DomainCandidate[] {
  const normalized = normalizeName(name);
  const lowerRaw = name.toLowerCase().trim();
  if (!lowerRaw || lowerRaw.length < 2) return [];

  const candidates: DomainCandidate[] = [];

  // Check known overrides first — match against BOTH raw and normalized
  // Sort keys longest-first so "hdfc bank" matches before "hdfc"
  const sortedKeys = Object.keys(NAME_DOMAIN_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lowerRaw.includes(key) || normalized.includes(key)) {
      candidates.push({ domain: NAME_DOMAIN_MAP[key], confidence: "high", method: "known_map" });
      return candidates; // authoritative match, no need for heuristics
    }
  }

  // Get country-specific TLDs
  const tlds = country && COUNTRY_TLD_MAP[country]
    ? COUNTRY_TLD_MAP[country]
    : [".com"];

  const norm = normalized || lowerRaw;
  const words = norm.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return [];

  // Strategy 1: First two words joined (e.g. "tata motors" -> "tatamotors.com")
  if (words.length >= 2) {
    const two = words.slice(0, 2).join("").replace(/[^a-z0-9]/g, "");
    if (two.length >= 3) {
      for (const tld of tlds) {
        candidates.push({ domain: `${two}${tld}`, confidence: "medium", method: "two_words" });
      }
    }
  }

  // Strategy 2: First word only (e.g. "Infosys" -> "infosys.com")
  const one = words[0].replace(/[^a-z0-9]/g, "");
  if (one.length >= 3) {
    for (const tld of tlds) {
      candidates.push({ domain: `${one}${tld}`, confidence: "low", method: "first_word" });
    }
  }

  // Strategy 3: All words joined (e.g. "Asian Paints" -> "asianpaints.com")
  if (words.length >= 3) {
    const all = words.join("").replace(/[^a-z0-9]/g, "");
    if (all.length >= 4 && all !== one) {
      candidates.push({ domain: `${all}.com`, confidence: "low", method: "all_words" });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return candidates.filter(c => {
    if (seen.has(c.domain)) return false;
    seen.add(c.domain);
    return true;
  });
}

/**
 * Try to derive a domain from a company name.
 * Returns domain string or null. (backward compatible)
 */
export function deriveDomain(name: string, country?: string): string | null {
  const candidates = deriveDomainCandidates(name, country);
  return candidates.length > 0 ? candidates[0].domain : null;
}
