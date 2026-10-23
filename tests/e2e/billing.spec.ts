import { expect, test } from "@playwright/test";
import sharp from "sharp";
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

  // She pays before any invoice exists: the Super Admin confirms it in one step.
  const received = admin.locator("form").filter({ hasText: "Option 1" });
  await expect(received.getByLabel("Montant reçu (DA)")).toHaveValue("18000");
  await received.getByLabel("Moyen de paiement").selectOption("CASH");
  await received.getByLabel("Référence du virement").fill("Espèces au salon");
  await received.getByRole("button", { name: "Confirmer le paiement" }).click();
  await expect(admin.getByText("Paiement confirmé. La facture payée figure ci-dessous.")).toBeVisible();
  await admin.reload();
  await expect(admin.getByText("Payée").first()).toBeVisible();
  await admin.getByRole("heading", { name: "Essai gratuit" }).scrollIntoViewIfNeeded();
  await admin.screenshot({ path: test.info().outputPath("abonnement.png"), fullPage: true });

  // Option 2: send her the next month's invoice; she declares her transfer with a photo of the receipt.
  await admin.getByRole("button", { name: "Envoyer la facture" }).click();
  await expect(admin.getByText("Une facture attend son paiement (ci-dessous).")).toBeVisible();
  await expect(admin.getByText("À payer").first()).toBeVisible();

  await page.goto("/fr/dashboard/provider/subscriptions");
  await expect(page.getByText("Prix convenu").first()).toBeVisible();
  const declare = page.locator("form").filter({ hasText: "Preuve du paiement" });
  await declare.getByLabel("Référence du virement").fill("BaridiMob 2026-11");
  await declare.getByLabel(/Preuve du paiement/).setInputFiles({ name: "recu.png", mimeType: "image/png", buffer: await sharp({ create: { width: 60, height: 40, channels: 3, background: "#8e3249" } }).png().toBuffer() });
  await declare.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("Merci, votre paiement est en cours de vérification.")).toBeVisible();

  await admin.goto("/fr/dashboard/admin/payments?status=PENDING");
  const row = admin.getByRole("row").filter({ hasText: business });
  const proof = row.getByRole("link", { name: "Voir la preuve" });
  await expect(proof).toBeVisible();
  const res = await admin.request.get((await proof.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/webp");
  await row.getByRole("button", { name: "Confirmer" }).click();
  await expect(admin.getByRole("row").filter({ hasText: business })).toHaveCount(0);

  // She pays the following month on her own, with no invoice from us; it lands on Paiements.
  // (She needs the account to pay into: the Super Admin publishes it in Paramètres.)
  await admin.goto("/fr/dashboard/admin/settings");
  await admin.getByLabel("Nom du titulaire").fill("Woman Cares Test");
  await admin.getByLabel("RIP ou RIB").fill("00799999000123456789");
  await admin.getByLabel("Votre mot de passe").fill("Bootstrap owner 2026 ok");
  await admin.getByRole("button", { name: "Enregistrer les coordonnées" }).click();
  await expect(admin.getByLabel("Votre mot de passe")).toHaveValue("");
  await page.goto("/fr/dashboard/provider/subscriptions");
  await page.getByText("J’ai payé mon abonnement").click();
  const ownPay = page.locator("form").filter({ hasText: "Montant envoyé (DA)" });
  await expect(ownPay.getByLabel("Montant envoyé (DA)")).toHaveValue("18000");
  await ownPay.getByLabel("Référence du virement").fill("CCP 2026-12");
  await ownPay.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("Merci, votre paiement est en cours de vérification.")).toBeVisible();
  await admin.goto("/fr/dashboard/admin/payments?status=PENDING");
  await expect(admin.getByRole("row").filter({ hasText: business }).getByRole("button", { name: "Confirmer" })).toBeVisible();
  await admin.close();
});
