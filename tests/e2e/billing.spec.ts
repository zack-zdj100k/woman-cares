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
  await expect(admin.getByText("Paiement confirmé. La facture payée figure ci-dessous.").first()).toBeVisible();
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
  await expect(page.getByText("Merci, votre paiement est en cours de vérification.").first()).toBeVisible();

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
  await expect(page.getByText("Merci, votre paiement est en cours de vérification.").first()).toBeVisible();
  await admin.goto("/fr/dashboard/admin/payments?status=PENDING");
  await expect(admin.getByRole("row").filter({ hasText: business }).getByRole("button", { name: "Confirmer" })).toBeVisible();
  await admin.close();
});

test("stopping a trial asks in the site's own dialog, then says it worked", async ({ page, browser }) => {
  const business = `Atelier Arret ${Date.now()}`;
  await newVerifiedProvider(page, `arret-${Date.now()}@test.invalid`, business);
  await page.getByRole("link", { name: "Mes profils" }).first().click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await completeAndSubmitProfile(page);
  const admin = await browser.newPage();
  await newSuperAdmin(admin);
  await openInQueue(admin, business);
  await admin.getByRole("button", { name: "Publier le profil" }).click();
  await expect(admin.getByText("Profil publié")).toBeVisible();
  await admin.reload();

  // No browser window: a native confirm() would fail the test.
  admin.on("dialog", () => {
    throw new Error("the browser's own confirm window was used");
  });
  await admin.getByRole("button", { name: "Arrêter l’essai gratuit maintenant" }).click();
  const dialog = admin.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Arrêter son essai gratuit maintenant ?")).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toBeHidden();

  await admin.getByRole("button", { name: "Arrêter l’essai gratuit maintenant" }).click();
  await expect(dialog).toBeVisible();
  await admin.waitForTimeout(400); // let it finish fading in
  await admin.screenshot({ path: test.info().outputPath("dialog.png") });
  await dialog.getByRole("button", { name: "Arrêter l’essai gratuit maintenant" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Essai gratuit arrêté." })).toBeVisible();
  await expect(admin.getByText("Accès payant uniquement")).toBeVisible();
  await admin.waitForTimeout(400);
  await admin.screenshot({ path: test.info().outputPath("toast.png") });
  await admin.close();
});

test("the trial end is chosen in the site's own calendar, on a phone and a computer", async ({ page, browser }) => {
  const business = `Atelier Date ${Date.now()}`;
  await newVerifiedProvider(page, `date-${Date.now()}@test.invalid`, business);
  await page.getByRole("link", { name: "Mes profils" }).first().click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await completeAndSubmitProfile(page);
  const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await newSuperAdmin(admin);
  await openInQueue(admin, business);
  await admin.getByRole("button", { name: "Publier le profil" }).click();
  await expect(admin.getByText("Profil publié")).toBeVisible();
  await admin.reload();

  for (const size of [{ width: 375, height: 800, name: "phone" }, { width: 1280, height: 900, name: "desktop" }]) {
    await admin.setViewportSize({ width: size.width, height: size.height });
    const field = admin.locator("form:has(input[name=endsOn]) button[aria-haspopup=dialog]");
    await field.scrollIntoViewIfNeeded();
    await field.click();
    const calendar = admin.getByRole("dialog");
    await expect(calendar).toBeVisible();
    await admin.waitForTimeout(350);
    await admin.screenshot({ path: test.info().outputPath(`calendrier-${size.name}.png`) });
    // Every day is a comfortable touch target.
    const box = await calendar.getByRole("button", { name: "15", exact: true }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeGreaterThanOrEqual(40);
    await calendar.getByRole("button", { name: "›" }).click();
    await calendar.getByRole("button", { name: "15", exact: true }).click();
    await expect(calendar).toBeHidden();
  }

  await admin.getByRole("button", { name: "Enregistrer la date" }).click();
  await expect(admin.getByRole("status").filter({ hasText: /Essai mis à jour/ }).or(admin.getByText("Essai mis à jour. La facturation suit la nouvelle date."))).toBeVisible();
  await admin.close();
});
