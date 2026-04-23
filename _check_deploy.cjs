const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  const jsUrls = [];
  page.on("response", resp => {
    const url = resp.url();
    if (url.includes("tradereplay.me") && url.includes(".js")) jsUrls.push(url);
  });

  await page.goto("https://tradereplay.me/screener/stocks?view=chart", { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(3000);

  // Find the screener chunk
  let fixStatus = "SCREENER_CHUNK_NOT_FOUND";
  for (const url of jsUrls) {
    if (url.includes("Screener")) {
      console.log("SCREENER_CHUNK:" + url);
      const resp = await page.evaluate(async (u) => {
        const r = await fetch(u);
        return r.text();
      }, url);
      if (resp.includes("isResizingRef") || resp.includes("isResizing")) {
        fixStatus = "NEW_FIX_DEPLOYED";
      } else {
        fixStatus = "OLD_BUNDLE_STILL_SERVING chunk=" + url.split("/").pop();
      }
      break;
    }
  }
  console.log("FIX_STATUS:" + fixStatus);
  console.log("ALL_SCREENER_JS:" + jsUrls.filter(u => u.includes("Screener")).join("|"));

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
