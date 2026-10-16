import { expect, test } from "@playwright/test";
import { completeAndSubmitProfile, newSuperAdmin, newVerifiedProvider, openInQueue } from "./flows";

test("an admin gives one professional an agreed monthly price, and the professional sees her trial", async ({ page, browser }) => {
  const business = `Atelier Tarif ${Date.now()}`;
  await newVerifiedProvider(page, `billing-${Date.now()}@test.invalid`, business);
  await page.getByRole("link", { name: "Mes profils" }).first().click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await completeAndSubmitProfile(page);

  const admin = await browser.newPage();
  await newSuperAdmin(admin);
  await openInQueue(admin, business);
  await admin.getByRole("button", { name: "Publier le profil" }).click();
  await expect(admin.getByText("Profil publié")).toBeVisible();

  // Publishing approves the account and opens the free trial; the price block appears.
  await admin.reload();
  await admin.getByRole("radio", { name: "Prix convenu" }).check();
  await admin.getByLabel("Montant mensuel (DA)").fill("18000");
  await admin.getByLabel("Raison (gardée dans le journal)").fill("Accord de lancement à Oran");
  await admin.getByRole("button", { name: "Enregistrer le prix" }).click();
  await expect(admin.getByText("Prix enregistré. Il s’applique à la prochaine facture.")).toBeVisible();
  await admin.reload();
  await expect(admin.getByRole("radio", { name: "Prix convenu" })).toBeChecked();
  await expect(admin.getByLabel("Montant mensuel (DA)")).toHaveValue("18000");
  await admin.close();

  await page.goto("/fr/dashboard/provider/subscriptions");
  await expect(page.getByText("Essai gratuit").first()).toBeVisible();
  await expect(page.getByText("Prix convenu").first()).toBeVisible();
});
