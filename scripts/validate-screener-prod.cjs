#!/usr/bin/env node
/**
 * Loop 6 production screener validator.
 * Runs 8 visual/structural checks × 7 viewports against live prod.
 *
 * Usage:
 *   PROD_URL=https://tradereplay.me node scripts/validate-screener-prod.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.PROD_URL || "https://tradereplay.me";
const OUT_DIR = path.resolve(__dirname, "..", "reports", "screenshots");
const REPORT_JSON = path.resolve(__dirname, "..", "reports", "screener_validation_loop6.json");

const VIEWPORTS = [
  { name: "mobile-xs",       width: 320,  height: 568 },
  { name: "mobile-iphone",   width: 390,  height: 844 },
  { name: "mobile-large",    width: 430,  height: 932 },
  { name: "tablet-portrait", width: 768,  height: 1024 },
  { name: "tablet-landscape",width: 1024, height: 768 },
  { name: "laptop",          width: 1280, height: 800 },
  { name: "desktop",         width: 1440, height: 900 },
];

const CHECKS = [
  {
    id: "C01",
    desc: "Screener page loads (body text > 200 chars)",
    run: async (page) => {
      const t = await page.evaluate(() => document.body.innerText || "");
      return { ok: t.length > 200, note: `bodyLen=${t.length}` };
    },
  },
  {
    id: "C02",
    desc: "At least 10 screener rows visible",
    run: async (page) => {
      await page.waitForSelector('[data-testid="screener-row"], [data-testid="screener-row-mobile"]', { timeout: 15000 }).catch(() => null);
      await new Promise(r => setTimeout(r, 1500));
      const n = await page.$$eval(
        '[data-testid="screener-row"], [data-testid="screener-row-mobile"]',
        (els) => els.length,
      ).catch(() => 0);
      return { ok: n >= 10, note: `rows=${n}` };
    },
  },
  {
    id: "C03",
    desc: "No literal 'undefined' / 'null' / 'NaN' in first 10 rows",
    run: async (page) => {
      const texts = await page.$$eval(
        '[data-testid="screener-row"], [data-testid="screener-row-mobile"]',
        (els) => els.slice(0, 10).map((el) => el.innerText || ""),
      ).catch(() => []);
      const bad = texts.filter((t) => /\bundefined\b|\bnull\b|\bNaN\b/.test(t));
      return { ok: bad.length === 0, note: bad.length ? `bad=${bad.length}` : `checked=${texts.length}` };
    },
  },
  {
    id: "C04",
    desc: "First row has a visible avatar (image loaded OR initials badge)",
    run: async (page) => {
      const res = await page.evaluate(() => {
        const row = document.querySelector('[data-testid="screener-row"], [data-testid="screener-row-mobile"]');
        if (!row) return { hasRow: false };
        const img = row.querySelector("img");
        if (img) return { hasRow: true, kind: "img", loaded: img.complete && img.naturalWidth > 0, src: (img.src || "").slice(0, 80) };
        const badge = row.querySelector('[role="img"]');
        if (badge) return { hasRow: true, kind: "badge", text: (badge.textContent || "").trim() };
        return { hasRow: true, kind: "none" };
      });
      if (!res.hasRow) return { ok: false, note: "noRow" };
      if (res.kind === "img") return { ok: !!res.loaded, note: `img loaded=${res.loaded}` };
      if (res.kind === "badge") return { ok: res.text && res.text.length > 0, note: `badge='${res.text}'` };
      return { ok: false, note: "noAvatar" };
    },
  },
  {
    id: "C05",
    desc: "No horizontal page overflow (scrollWidth ≤ innerWidth + 5px)",
    run: async (page) => {
      const r = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }));
      return { ok: r.sw <= r.iw + 5, note: `sw=${r.sw} iw=${r.iw}` };
    },
  },
  {
    id: "C06",
    desc: "Result count element shows a non-zero number",
    run: async (page) => {
      const text = await page.$eval(
        '[data-testid="screener-result-count"]',
        (el) => (el.textContent || "").replace(/,/g, ""),
      ).catch(() => "");
      const n = parseInt(text, 10);
      return { ok: Number.isFinite(n) && n > 0, note: `count=${n || "?"}` };
    },
  },
  {
    id: "C07",
    desc: "At least one price cell shows currency symbol or em-dash",
    run: async (page) => {
      const vals = await page.evaluate(() => {
        const rows = document.querySelectorAll('[data-testid="screener-row"], [data-testid="screener-row-mobile"]');
        const out = [];
        rows.forEach((r, i) => {
          if (i >= 10) return;
          const cells = r.querySelectorAll("span, p");
          cells.forEach((c) => {
            const t = (c.textContent || "").trim();
            if (t && /^[$₹£€¥]|^—|^HK\$|^A\$|^C\$|^S\$|^₩|^R\$|^MX\$/.test(t)) out.push(t);
          });
        });
        return out.slice(0, 20);
      });
      return { ok: vals.length > 0, note: `priceSample=${vals.slice(0, 3).join("|") || "none"}` };
    },
  },
  {
    id: "C08",
    desc: "Row href contains /symbol/ path",
    run: async (page) => {
      const href = await page.$eval(
        '[data-testid="screener-row"], [data-testid="screener-row-mobile"]',
        (el) => (el.tagName === "A" ? el.getAttribute("href") : null) || el.querySelector("a")?.getAttribute("href") || "",
      ).catch(() => "");
      return { ok: href.includes("/symbol/"), note: `href=${href.slice(0, 60)}` };
    },
  },
];

async function main() {
  let puppeteer;
  try { puppeteer = require("puppeteer"); }
  catch { console.error("puppeteer not installed. Run: npm i -D puppeteer"); process.exit(2); }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const results = [];
  for (const v of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: v.width, height: v.height });
    const url = `${BASE_URL}/screener/stocks?marketCountries=IN&sort=marketCap&order=desc`;

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
      await new Promise(r => setTimeout(r, 3000));

      const shotPath = path.join(OUT_DIR, `screener_${v.name}_loop6.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      for (const c of CHECKS) {
        let r;
        try { r = await c.run(page); }
        catch (e) { r = { ok: false, note: `ERR:${e.message.slice(0, 80)}` }; }
        results.push({ viewport: v.name, id: c.id, desc: c.desc, ok: !!r.ok, note: r.note || "" });
        console.log(`[${v.name.padEnd(17)}] ${c.id} ${r.ok ? "PASS" : "FAIL"} ${c.desc} — ${r.note || ""}`);
      }
    } catch (e) {
      console.error(`[${v.name}] load failed: ${e.message}`);
      CHECKS.forEach(c => results.push({ viewport: v.name, id: c.id, desc: c.desc, ok: false, note: `loadFail:${e.message.slice(0, 60)}` }));
    }
    await page.close();
  }

  await browser.close();

  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  console.log("\n=== SCREENER VALIDATION SUMMARY ===");
  console.log(`PASS: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`);
  const fails = results.filter((r) => !r.ok);
  if (fails.length) {
    console.log("\nFAILURES:");
    fails.forEach(f => console.log(`  [${f.viewport}] ${f.id}: ${f.desc} — ${f.note}`));
  }

  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify({
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: { total, passed, failed: total - passed, passPct: +((passed / total) * 100).toFixed(1) },
    results,
  }, null, 2));

  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
