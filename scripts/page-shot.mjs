// Visual QA: full-page screenshot below the pinned hero (reveals triggered first).
// Usage: CHROMIUM_PATH=... node scripts/page-shot.mjs <url> <width> <height> <out.jpg>
import { chromium } from "@playwright/test";
const [url, w, h, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  // Only the homepage has the pinned hero; collapse it so the full-page capture stays readable.
  const hero = document.getElementById("hero-end") ? document.querySelector("section") : null;
  if (hero) hero.style.height = "100dvh";
  for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
    window.scrollTo({ top: y, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo({ top: hero ? hero.offsetHeight : 0, behavior: "instant" });
});
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 80, timeout: 30000 });
console.log("overflow px:", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
await browser.close();
