/**
 * Gemini AI Logo Validation Service
 *
 * Uses Google Gemini (free tier) to:
 * 1. Validate if a logo URL visually matches a company
 * 2. Resolve unknown company domains via AI
 * 3. Batch-validate logos with rate limiting
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const GEMINI_MODEL = "gemini-2.0-flash";
const MAX_RETRIES = 2;
const RATE_LIMIT_DELAY_MS = 1200; // ~50 req/min on free tier

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI;
}

export interface LogoValidationResult {
  isCorrect: boolean;
  confidence: number;
  suggestedDomain?: string;
  reason: string;
}

export interface DomainResolutionResult {
  domain: string;
  confidence: number;
  reason: string;
}

/**
 * Validate whether a logo URL belongs to the correct company using Gemini AI.
 */
export async function validateLogoWithAI(
  symbol: string,
  companyName: string,
  logoUrl: string,
  type: string,
): Promise<LogoValidationResult> {
  const model = getGenAI().getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `You are a financial logo validator. Given a company's details and logo URL, determine if the logo is correct.

Company: ${companyName}
Symbol: ${symbol}
Type: ${type}
Logo URL: ${logoUrl}

Rules:
- If the logo URL domain matches the company's actual website, mark as correct with high confidence
- Google Favicon URLs (google.com/s2/favicons?domain=X) are correct IF domain X matches the company
- CoinGecko URLs are correct for crypto assets
- Generic placeholder icons (globe, default favicons) should be rejected
- FMP (financialmodelingprep.com) URLs that are image-stock are acceptable but low confidence
- Clearbit URLs with the right domain are acceptable

Return ONLY valid JSON (no markdown, no backticks):
{"isCorrect":true/false,"confidence":0.0-1.0,"suggestedDomain":"correct-domain.com","reason":"brief explanation"}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON in response");
      }
      return JSON.parse(jsonMatch[0]) as LogoValidationResult;
    } catch (err: any) {
      if (attempt < MAX_RETRIES && (err.status === 429 || err.status === 503)) {
        await delay(RATE_LIMIT_DELAY_MS * (attempt + 1));
        continue;
      }
      logger.warn("gemini_logo_validation_failed", {
        symbol,
        error: err.message,
        attempt,
      });
      return {
        isCorrect: false,
        confidence: 0,
        reason: `AI validation failed: ${err.message}`,
      };
    }
  }
  return { isCorrect: false, confidence: 0, reason: "max retries exceeded" };
}

/**
 * Use Gemini AI to resolve the correct website domain for a company.
 */
export async function resolveDomainWithAI(
  symbol: string,
  companyName: string,
  exchange: string,
  type: string,
): Promise<DomainResolutionResult> {
  const model = getGenAI().getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `You are a financial data expert. Find the official website domain for this company.

Company Name: ${companyName}
Symbol: ${symbol}
Exchange: ${exchange}
Type: ${type}

Rules:
- Return the company's PRIMARY official website domain (e.g. apple.com, not investor.apple.com)
- For ETFs, return the fund provider's domain (e.g. SPY → ssga.com, QQQ → invesco.com)
- For Indian stocks on NSE/BSE, return the Indian company domain
- For crypto, return the project's official domain
- For forex pairs, return "" (no domain)
- If unsure, return "" with low confidence

Return ONLY valid JSON (no markdown, no backticks):
{"domain":"example.com","confidence":0.0-1.0,"reason":"brief explanation"}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON in response");
      }
      const parsed = JSON.parse(jsonMatch[0]) as DomainResolutionResult;
      // Sanitize domain
      if (parsed.domain) {
        parsed.domain = parsed.domain
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\/.*$/, "")
          .toLowerCase()
          .trim();
      }
      return parsed;
    } catch (err: any) {
      if (attempt < MAX_RETRIES && (err.status === 429 || err.status === 503)) {
        await delay(RATE_LIMIT_DELAY_MS * (attempt + 1));
        continue;
      }
      logger.warn("gemini_domain_resolution_failed", {
        symbol,
        error: err.message,
        attempt,
      });
      return { domain: "", confidence: 0, reason: `AI failed: ${err.message}` };
    }
  }
  return { domain: "", confidence: 0, reason: "max retries exceeded" };
}

/**
 * Batch-validate logos with rate limiting.
 */
export async function batchValidateLogos(
  assets: Array<{
    symbol: string;
    name: string;
    iconUrl: string;
    type: string;
  }>,
): Promise<Map<string, LogoValidationResult>> {
  const results = new Map<string, LogoValidationResult>();

  for (const asset of assets) {
    const result = await validateLogoWithAI(
      asset.symbol,
      asset.name,
      asset.iconUrl,
      asset.type,
    );
    results.set(asset.symbol, result);
    await delay(RATE_LIMIT_DELAY_MS);
  }

  return results;
}

/**
 * Batch-resolve domains with rate limiting.
 */
export async function batchResolveDomains(
  assets: Array<{
    symbol: string;
    name: string;
    exchange: string;
    type: string;
  }>,
): Promise<Map<string, DomainResolutionResult>> {
  const results = new Map<string, DomainResolutionResult>();

  for (const asset of assets) {
    const result = await resolveDomainWithAI(
      asset.symbol,
      asset.name,
      asset.exchange,
      asset.type,
    );
    results.set(asset.symbol, result);
    await delay(RATE_LIMIT_DELAY_MS);
  }

  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
