// QA: loads a page in headless Chromium and prints console errors/warnings and page errors.
// Usage: CHROMIUM_PATH=... node scripts/console-check.mjs <url> [width]
import { chromium } from "@playwright/test";
const [url, w = "1440"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: +w, height: 900 } });
const out = [];
page.on("console", (m) => ["error", "warning"].includes(m.type()) && out.push(`[${m.type()}] ${m.text().slice(0, 600)}`));
page.on("pageerror", (e) => out.push(`[pageerror] ${e.message.slice(0, 600)}`));
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(6000);
console.log(out.length ? out.join("\n---\n") : "no console errors");
await browser.close();
