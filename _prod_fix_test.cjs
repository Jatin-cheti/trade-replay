const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  await page.goto("https://tradereplay.me/screener/stocks?view=chart", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  // Get the deployed JS bundle sources
  const scriptSrcs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("script[src]"))
      .map(s => s.getAttribute("src"))
      .filter(s => s && s.includes("assets/"))
      .slice(0, 5);
  });

  // Fetch the main bundle and look for the fix
  const fixStatus = await page.evaluate(async (srcs) => {
    for (const src of srcs) {
      try {
        const url = src.startsWith("http") ? src : "https://tradereplay.me" + src;
        const resp = await fetch(url);
        const text = await resp.text();
        if (text.includes("Clear stale crosshair") || text.includes("stale crosshair")) return "FIX_FOUND_COMMENT";
        if (text.includes("setHoverInfo(null)") && text.includes("resizeChartSurface")) return "FIX_FOUND_CODE";
        if (text.includes("resizeChartSurface")) return "OLD_BUNDLE_NO_FIX";
      } catch(e) {}
    }
    return "BUNDLES_NOT_CHECKED";
  }, scriptSrcs);

  const cards = await page.$$("[data-testid='screener-chart-card']");
  const canvases = await page.$$("canvas");
  const nonEmptyCanvases = await page.evaluate(() => {
    let n = 0;
    document.querySelectorAll("canvas").forEach(c => {
      try {
        const d = c.getContext("2d").getImageData(0,0,c.width,c.height).data;
        for (let i=3;i<d.length;i+=4) if(d[i]>10){n++;break;}
      } catch{}
    });
    return n;
  });

  await page.screenshot({ path: "prod_fix_test.png" });
  console.log("FIX_STATUS:" + fixStatus);
  console.log("CARDS:" + cards.length);
  console.log("CANVASES:" + canvases.length + " (non-empty:" + nonEmptyCanvases + ")");
  console.log("SCRIPT_SRCS:" + scriptSrcs.join("|"));
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
