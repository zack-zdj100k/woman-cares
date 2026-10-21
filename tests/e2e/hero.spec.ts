import { expect, test } from "@playwright/test";

const state = (page: import("@playwright/test").Page) =>
  page.evaluate(() => ({
    y: Math.round(window.scrollY),
    scene: [...document.querySelectorAll("section nav li button")].findIndex((b) => b.getAttribute("aria-current") === "true"),
  }));

test("the home hero holds the page until the last scene, then releases it to the landing content", async ({ page }) => {
  await page.goto("/fr");
  // The lock is attached once the page has hydrated; the first clip playing proves that.
  await expect.poll(() => page.evaluate(() => (document.querySelector("section video") as HTMLVideoElement | null)?.currentTime ?? 0), { timeout: 15_000 }).toBeGreaterThan(0.3);
  await page.mouse.move(640, 400);
  expect(await state(page)).toEqual({ y: 0, scene: 0 });

  // A burst of wheel events (a trackpad flick) moves exactly one scene, and the page does not scroll.
  await page.evaluate(() => {
    for (let i = 0; i < 25; i++) window.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, cancelable: true, bubbles: true }));
  });
  await expect.poll(() => state(page), { timeout: 4000 }).toEqual({ y: 0, scene: 1 });

  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => state(page), { timeout: 4000 }).toEqual({ y: 0, scene: 2 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => state(page), { timeout: 4000 }).toEqual({ y: 0, scene: 3 });

  // After the last scene one more gesture releases the page onto the landing content.
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => window.scrollY >= window.innerHeight - 2), { timeout: 6000 }).toBe(true);
  await expect(page.getByRole("heading", { name: /Six univers/ })).toBeVisible();

  // Scrolling back to the top returns to the last scene and steps back through the scenes.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(async () => (await state(page)).y, { timeout: 4000 }).toBeLessThan(2);
  expect((await state(page)).scene).toBe(3);
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await state(page)).scene, { timeout: 4000 }).toBe(2);
});
