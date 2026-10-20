import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { PASSWORD, completeAndSubmitProfile, form, newSuperAdmin, newVerifiedClient, newVerifiedProvider, openInQueue } from "./flows";

test("a client picks a time, signs in, sends the request, and the professional accepts it", async ({ page, browser }) => {
  // A published profile: the professional submits, staff publish.
  const business = `Atelier Creneau ${Date.now()}`;
  await newVerifiedProvider(page, `slots-${Date.now()}@test.invalid`, business);
  await page.getByRole("link", { name: "Mes profils" }).first().click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await completeAndSubmitProfile(page);
  const admin = await browser.newPage();
  await newSuperAdmin(admin);
  await openInQueue(admin, business);
  await admin.getByRole("button", { name: "Publier le profil" }).click();
  await expect(admin.getByText("Profil publié")).toBeVisible();
  await admin.close();

  // The client account exists; she browses signed out.
  const client = await browser.newPage();
  const email = `booking-${Date.now()}@test.invalid`;
  await newVerifiedClient(client, email);
  await client.goto("/fr/nails");
  await client.getByRole("link", { name: business }).click();
  const panel = client.locator("#reserver");
  await expect(panel.getByRole("radio", { name: /Pose gel/ })).toBeChecked();
  const time = panel.getByRole("button", { pressed: false }).filter({ hasText: /^\d{2}:\d{2}/ }).first();
  const label = (await time.textContent())!.slice(0, 5);
  await time.click();
  await expect(panel.getByText("Votre demande")).toBeVisible();

  // Signing in brings her back with the same choice.
  await panel.getByRole("link", { name: "Se connecter pour réserver" }).click();
  const f = form(client);
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await f.getByRole("button", { name: "Se connecter" }).click();
  await expect(client).toHaveURL(/\/fr\/profiles\//);
  await expect(panel.getByRole("button", { pressed: true }).filter({ hasText: label })).toBeVisible();
  await panel.getByLabel("Décrivez ce que vous souhaitez (facultatif)").fill("Ongles courts, merci.");
  const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#c98" } }).png().toBuffer();
  await panel.locator('input[type="file"]').setInputFiles({ name: "modele.png", mimeType: "image/png", buffer: png });
  await expect(panel.getByRole("img", { name: "Photos d’inspiration (facultatif) 1" })).toBeVisible();
  await panel.getByRole("button", { name: "Demander un rendez-vous" }).click();
  const sent = panel.getByRole("status");
  await expect(sent).toContainText("Demande envoyée");
  await expect(sent).toContainText("Photos envoyées à la professionnelle.");
  await expect(sent).toContainText(/WC-[A-Z2-9]{6}/);
  await expect(sent).toContainText("En attente de réponse");

  // The confirmation opens the new appointment, and "back" returns to the profile she came from.
  const profileUrl = client.url();
  await sent.getByRole("link", { name: "Voir ce rendez-vous" }).click();
  await expect(client).toHaveURL(/\/fr\/dashboard\/client\/appointments\/[0-9a-f-]{36}$/);
  await expect(client.getByText(/WC-[A-Z2-9]{6}/).first()).toBeVisible();
  const mine = client.getByRole("img", { name: "Photos d’inspiration 1" });
  await expect(mine).toBeVisible();
  expect(await mine.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await client.getByRole("link", { name: "Retour à la liste" }).click();
  await expect(client).toHaveURL(profileUrl);

  // The professional answers from her bookings table.
  await page.goto("/fr/dashboard/provider/bookings");
  await page.getByRole("link", { name: "Ouvrir" }).first().click();
  await expect(page.getByText("Ongles courts, merci.")).toBeVisible();
  const theirs = page.getByRole("img", { name: "Photos d’inspiration 1" });
  await expect(theirs).toBeVisible();
  expect(await theirs.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Accepter" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rendez-vous mis à jour." })).toBeVisible();
  await expect(page.getByText("Confirmé").first()).toBeVisible();

  // The client sees it confirmed, opens it, and cancels; the history records both steps.
  await client.goto("/fr/dashboard/client/appointments");
  await expect(client.getByText("Confirmé", { exact: true })).toBeVisible();
  await client.getByRole("link", { name: /WC-[A-Z2-9]{6}/ }).click();
  await client.getByRole("button", { name: "Annuler le rendez-vous" }).click();
  await client.getByLabel("Motif (facultatif)").fill("Empêchement");
  await client.getByRole("button", { name: "Confirmer l’annulation" }).click();
  await expect(client.getByRole("status").filter({ hasText: "Rendez-vous annulé." })).toBeVisible();
  await expect(client.getByText("Empêchement")).toBeVisible();
  await client.close();
});
