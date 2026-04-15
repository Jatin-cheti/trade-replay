import { logger } from "../../utils/logger";

const TIMEOUT_MS = 5000;

const STOP_WORDS = new Set(["inc", "ltd", "limited", "corp", "corporation", "plc", "the", "and", "of", "sa", "nv", "ag", "group", "holdings", "co", "company", "etf", "fund", "trust", "daily", "shares", "leverage", "leveraged", "inverse", "long", "short", "2x", "3x", "direxion", "proshares", "tradr", "index", "tracking"]);

function inferDomains(companyName: string): string[] {
  const cleaned = companyName
    .toLowerCase()
    .replace(/[,.'&!@#$%^*()+={}\[\]|\\:;"<>?\/~`-]/g, "")
    .replace(new RegExp(`\\b(${[...STOP_WORDS].join("|")})\\b`, "gi"), "")
    .trim()
    .replace(/\s+/g, "");

  const domains: string[] = [];

  if (cleaned.length >= 2) {
    domains.push(`${cleaned}.com`, `${cleaned}.co.in`, `${cleaned}.in`, `${cleaned}.co`, `${cleaned}.io`, `${cleaned}.net`, `${cleaned}.org`);
  }

  const words = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => !STOP_WORDS.has(w) && w.length > 1);

  if (words.length > 0 && words[0] !== cleaned) {
    domains.push(`${words[0]}.com`, `${words[0]}.co.in`, `${words[0]}.in`);
  }
  if (words.length >= 2) {
    const twoWord = words.slice(0, 2).join("");
    if (twoWord !== cleaned) {
      domains.push(`${twoWord}.com`, `${twoWord}.co.in`);
    }
  }
  if (words.length >= 2) {
    const hyphenated = words.slice(0, 2).join("-");
    domains.push(`${hyphenated}.com`);
  }

  return [...new Set(domains)];
}

async function verifyDomain(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`https://${domain}`, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "tradereplay-scraper/1.0" },
    });
    clearTimeout(timer);
    return res.ok || res.status === 301 || res.status === 302;
  } catch {
    return false;
  }
}

export async function searchDomainDDG(companyName: string): Promise<string[]> {
  const candidates = inferDomains(companyName);
  const verified: string[] = [];

  for (const domain of candidates) {
    try {
      const isValid = await verifyDomain(domain);
      if (isValid) {
        verified.push(`https://${domain}`);
        break;
      }
    } catch {
      // skip
    }
  }

  if (verified.length === 0) {
    logger.warn("domain_inference_failed", { companyName, triedDomains: candidates.length });
  }

  return verified;
}

export function extractDomainFromUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}