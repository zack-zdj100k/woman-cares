// Visual QA: screenshots the pinned hero at given scroll progress values.
// Usage: node scripts/hero-shots.mjs <url> <width> <height> <out-prefix> <progress,...>
import { chromium } from "@playwright/test";
const [url, w, h, out, prog = "0"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(2500);
for (const p of prog.split(",").map(Number)) {
  await page.evaluate((p) => {
    const s = document.querySelector("section");
    window.scrollTo({ top: (s.offsetHeight - innerHeight) * p, behavior: "instant" });
  }, p);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}-${Math.round(p * 100)}.jpg`, type: "jpeg", quality: 85, timeout: 20000 });
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
console.log("horizontal overflow px:", overflow);
await browser.close();
