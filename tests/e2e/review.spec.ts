import { expect, test } from "@playwright/test";
import { completeAndSubmitProfile, newSuperAdmin, newVerifiedProvider, openInQueue } from "./flows";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

test("staff approval publishes a submitted profile in the directory", async ({ page, browser }) => {
  const business = `Atelier Revue ${Date.now()}`;
  await newVerifiedProvider(page, `review-${Date.now()}@test.invalid`, business);
  await page.getByRole("link", { name: "Mes profils" }).first().click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await completeAndSubmitProfile(page);

  const admin = await browser.newPage();
  await newSuperAdmin(admin);
  await expect(admin.getByRole("link", { name: "Ouvrir la file" })).toBeVisible();
  await openInQueue(admin, business);
  await admin.getByRole("button", { name: "Publier le profil" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Décision enregistrée. La professionnelle est prévenue." })).toBeVisible();
  await expect(admin.getByRole("button", { name: "Publier le profil" })).toHaveCount(0);
  await expect(admin.getByText("Profil publié")).toBeVisible();
  await expect(admin.getByText("Compte approuvé")).toBeVisible();

  await page.goto("/fr/nails");
  await expect(page.getByText(business).first()).toBeVisible();
  await admin.close();
});

test("Botox needs a private credential approved by staff before the category opens", async ({ page, browser }) => {
  const business = `Cabinet Botox ${Date.now()}`;
  await newVerifiedProvider(page, `botox-${Date.now()}@test.invalid`, business, ["Ongles", "Botox"]);
  await page.getByRole("link", { name: "Mes profils" }).first().click();
  const credentials = page.locator("section").filter({ has: page.getByRole("heading", { name: "Justificatifs de qualification" }) });
  await credentials.getByLabel("Catégorie").selectOption("botox");
  await credentials.getByLabel("Type de document").selectOption("diploma");
  await credentials.locator("input[type=file]").setInputFiles({ name: "diplome.pdf", mimeType: "application/pdf", buffer: PDF });
  await credentials.getByRole("button", { name: "Envoyer le document" }).click();
  await expect(credentials.getByText("En attente")).toBeVisible();

  const admin = await browser.newPage();
  await newSuperAdmin(admin);
  await openInQueue(admin, business);

  // The request cannot be accepted before the document is validated.
  await admin.getByRole("button", { name: "Accepter la demande" }).click();
  await expect(admin.getByText("Un justificatif validé et encore valable est requis pour cette catégorie.")).toBeVisible();

  // The document is served privately, to staff only, as a download.
  const href = await admin.getByRole("link", { name: "Ouvrir le document" }).getAttribute("href");
  const file = await admin.request.get(href!);
  expect(file.status()).toBe(200);
  expect(file.headers()["cache-control"]).toContain("no-store");
  expect(file.headers()["content-disposition"]).toContain("attachment");
  expect((await page.request.get(href!)).status()).toBe(404);

  await admin.getByRole("button", { name: "Valider le document" }).click();
  await expect(admin.getByText("Justificatif validé").first()).toBeVisible();
  await admin.getByRole("button", { name: "Accepter la demande" }).click();
  await expect(admin.getByText("Demande de catégorie acceptée")).toBeVisible();

  // A Botox draft now sits next to the nails draft, ready to be completed.
  await page.reload();
  await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(2);
  await admin.close();
});
