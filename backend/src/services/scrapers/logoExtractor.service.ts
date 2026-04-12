import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../../utils/logger";

const TIMEOUT_MS = 8000;

export async function extractLogoFromWebsite(domain: string): Promise<string | null> {
  try {
    const { data } = await axios.get(`https://${domain}`, {
      timeout: TIMEOUT_MS,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      maxRedirects: 3,
      responseType: "text",
      maxContentLength: 1_500_000,
    });

    const $ = cheerio.load(data);

    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage && isValidImageUrl(ogImage)) return normalizeUrl(domain, ogImage);

    const appleIcon = $('link[rel="apple-touch-icon"]').attr("href") || $('link[rel="apple-touch-icon-precomposed"]').attr("href");
    if (appleIcon && isValidImageUrl(appleIcon)) return normalizeUrl(domain, appleIcon);

    const iconLinks: Array<{ href: string; size: number }> = [];
    $('link[rel="icon"], link[rel="shortcut icon"]').each((_: number, el: any) => {
      const href = $(el).attr("href");
      const sizes = $(el).attr("sizes") || "";
      const sizeMatch = sizes.match(/(\d+)x(\d+)/);
      const size = sizeMatch ? parseInt(sizeMatch[1]!, 10) : 16;
      if (href && isValidImageUrl(href)) iconLinks.push({ href, size });
    });

    iconLinks.sort((a, b) => b.size - a.size);
    if (iconLinks.length > 0) return normalizeUrl(domain, iconLinks[0]!.href);

    return `https://${domain}/favicon.ico`;
  } catch (error: unknown) {
    logger.warn("logo_extraction_failed", { domain, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

function normalizeUrl(domain: string, url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://${domain}${url}`;
  return `https://${domain}/${url}`;
}

function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 5) return false;
  if (url.startsWith("data:")) return false;
  if (url.includes("tracking") || url.includes("pixel") || url.includes("1x1")) return false;
  return true;
}