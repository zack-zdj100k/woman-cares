import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";
import { linkFromEmail } from "./db";

export const PASSWORD = "Jasmin et rose 7";
export const form = (page: Page) => page.locator("main form").filter({ visible: true }).first();

/**
 * Each test account signs up as its own visitor (a distinct client IP), as real users do. The
 * sign-up limit (10 per IP per hour) stays in force; the suite simply no longer funnels every
 * account through one address.
 */
async function asNewVisitor(page: Page) {
  const octet = () => 1 + Math.floor(Math.random() * 254);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

/** Signs up a professional offering nails, confirms the email and signs in. */
export async function newVerifiedProvider(page: Page, email: string, business: string, categories: string[] = ["Ongles"]) {
  await asNewVisitor(page);
  await page.goto("/fr/auth/sign-up?role=provider");
  const f = form(page);
  await f.getByLabel("Nom complet").fill("Lina Kaci");
  await f.getByLabel("Nom de l’établissement ou nom professionnel").fill(business);
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Téléphone").fill("0661 23 45 67");
  await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await f.locator("select[name=wilaya]").selectOption("16");
  await f.getByLabel("En salon").check();
  for (const c of categories) await f.getByLabel(c, { exact: true }).check();
  await f.getByRole("checkbox", { name: /J’accepte/ }).check();
  await f.getByRole("button", { name: "Créer mon compte professionnel" }).click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();
  // Automated browsers do not confirm on their own (that protects the link from mail scanners): press
  // the button. A first confirmation signs her in and opens her space.
  await page.goto(await linkFromEmail(email, "verify-email"));
  await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard\/provider$/);
}

/** Fills the first draft profile (nails) and sends it for review. Starts on the editor page. */
export async function completeAndSubmitProfile(page: Page) {
  const details = page.locator("#details form");
  await details.getByLabel("Accroche").fill("Semi-permanent et nail art soigné");
  await details.getByLabel("Description").fill("Un atelier calme pour la manucure, la pose gel et le nail art sur mesure.");
  await details.getByText("Pose gel").click();
  await details.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("#details").getByRole("status")).toHaveText("Enregistré");

  const svc = page.locator("#services details").last();
  await svc.getByLabel("Nom de la prestation").fill("Pose gel");
  await svc.getByLabel("Durée (minutes)").fill("90");
  await svc.getByLabel("Prix à partir de (DA)").fill("3500");
  await svc.getByRole("button", { name: "Ajouter une prestation" }).click();
  await expect(page.locator("#services summary").filter({ hasText: "Pose gel" })).toBeVisible();

  await page.locator("#portfolio input[type=file]").setInputFiles("public/images/hero/chapter-17.jpg");
  await expect(page.locator("#portfolio").getByText("Image de la carte")).toBeVisible({ timeout: 15000 });

  await page.locator("#hours").getByRole("checkbox", { name: "Samedi" }).check();
  await page.locator("#hours").getByRole("button", { name: "Enregistrer les horaires" }).click();
  await expect(page.locator("#hours").getByRole("status")).toHaveText("Enregistré");

  await page.locator("#publication").getByRole("button", { name: "Envoyer pour vérification" }).click();
  await expect(page.locator("#publication").getByText("En cours de vérification par notre équipe")).toBeVisible();
}

/** Creates a Super Admin with the bootstrap CLI (the only way to create one) and signs in. */
export async function newSuperAdmin(page: Page) {
  const email = `owner-${Date.now()}@test.invalid`;
  const password = "Bootstrap owner 2026 ok";
  execSync(`npx tsx scripts/create-super-admin.ts --email ${email} --name "Owner Test"`, {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, SUPER_ADMIN_PASSWORD: password },
    stdio: "ignore",
  });
  await page.goto("/fr/auth/sign-in");
  const s = form(page);
  await s.getByLabel("E-mail").fill(email);
  await s.getByLabel("Mot de passe", { exact: true }).fill(password);
  await s.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard\/admin$/);
}

/** Opens a professional's review page from the admin queue. */
export async function openInQueue(admin: Page, business: string) {
  await admin.goto("/fr/dashboard/admin/providers");
  await admin.getByRole("textbox", { name: "Nom, établissement ou e-mail" }).fill(business);
  await admin.getByRole("button", { name: "Rechercher" }).click();
  await expect(admin).toHaveURL(/q=/);
  await admin.getByRole("listitem").filter({ hasText: business }).getByRole("link", { name: "Examiner" }).click();
  await expect(admin.getByRole("heading", { name: business, level: 1 })).toBeVisible();
}

/** Signs up a client, confirms the email from the outbox link. Ends signed out. */
export async function newVerifiedClient(page: Page, email: string, name = "Amina Benali") {
  await asNewVisitor(page);
  await page.goto("/fr/auth/sign-up");
  const f = form(page);
  await f.getByLabel("Nom complet").fill(name);
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Téléphone").fill("0550 12 34 56");
  await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await f.getByRole("checkbox").check();
  await f.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();
  await page.goto(await linkFromEmail(email, "verify-email"));
  await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard\/client$/);
  // Confirming signs her in; callers want a visitor who has not (they sign in themselves, or browse as a guest).
  await page.context().clearCookies();
}
