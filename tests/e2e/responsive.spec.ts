import { expect, test } from "@playwright/test";

test("auth pages fit a phone screen without horizontal scrolling", async ({ page }) => {
  for (const path of ["/fr/auth/sign-in", "/fr/auth/sign-up?role=provider", "/ar/auth/sign-up"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
