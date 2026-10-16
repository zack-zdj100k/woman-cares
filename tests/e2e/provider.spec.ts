import { expect, test } from "@playwright/test";
import { completeAndSubmitProfile, newVerifiedProvider } from "./flows";

test("a professional completes a profile and sends it for review", async ({ page }) => {
  await newVerifiedProvider(page, `editor-${Date.now()}@test.invalid`, "Atelier Editeur");
  await page.getByRole("link", { name: "Mes profils" }).first().click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(page.getByRole("heading", { name: "Ongles", level: 1 })).toBeVisible();

  await completeAndSubmitProfile(page);
  // Still not public: drafts and profiles under review never appear in the directory.
  await page.goto("/fr/nails");
  await expect(page.getByText("Atelier Editeur")).toHaveCount(0);
});

test("a professional cannot open another professional's editor", async ({ page, browser }) => {
  await newVerifiedProvider(page, `owner-${Date.now()}@test.invalid`, "Atelier Proprietaire");
  await page.getByRole("link", { name: "Mes profils" }).first().click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard\/provider\/profiles\/[0-9a-f-]{36}$/);
  const editorUrl = page.url();

  const other = await browser.newPage();
  await newVerifiedProvider(other, `intruder-${Date.now()}@test.invalid`, "Studio Intrus");
  await other.goto(editorUrl);
  await expect(other.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  const upload = await other.request.post(`${editorUrl.replace(/\/fr\/dashboard\/provider\/profiles\//, "/api/v1/provider/profiles/")}/media`, {
    headers: { origin: new URL(editorUrl).origin },
    multipart: { file: { name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) } },
  });
  expect(upload.status()).toBe(404);
  await other.close();
});
