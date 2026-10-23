import { expect, test, type Page } from "@playwright/test";
import { linkFromEmail } from "./db";

const PASSWORD = "Jasmin et rose 7";

/** The visible form in <main> (the search dialog lives outside <main>; streamed placeholders are hidden). */
const form = (page: Page) => page.locator("main form").filter({ visible: true }).first();

async function signIn(page: Page, email: string, password = PASSWORD) {
  const f = form(page);
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Mot de passe", { exact: true }).fill(password);
  await f.getByRole("button", { name: "Se connecter" }).click();
}

test("dashboards require a session and keep the requested page", async ({ page }) => {
  await page.goto("/fr/dashboard/admin");
  await expect(page).toHaveURL(/\/fr\/auth\/sign-in\?next=%2Ffr%2Fdashboard%2Fadmin/);
});

test("a client signs up, verifies her email, signs in and cannot open other areas", async ({ page }) => {
  const email = `cliente-${Date.now()}@test.invalid`;
  await page.goto("/fr/auth/sign-up");
  const f = form(page);
  await f.getByLabel("Nom complet").fill("Amina Benali");
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Téléphone").fill("0550 12 34 56");
  await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await f.getByRole("checkbox").check();
  await f.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();

  // Open the link from the email; confirmation is a deliberate POST, and it signs her in.
  await page.goto(await linkFromEmail(email, "verify-email"));
  await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard\/client$/);
  await expect(page.getByRole("heading", { name: "Bonjour Amina" })).toBeVisible();
  await expect(page.getByText("Confirmez votre adresse e-mail")).toHaveCount(0);

  for (const area of ["admin", "provider"]) {
    await page.goto(`/fr/dashboard/${area}`);
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    await expect(page.getByText("Administration")).toHaveCount(0);
  }

  // Sign out from the account menu.
  await page.goto("/fr/dashboard/client");
  await page.getByRole("button", { name: "Mon compte" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page.getByText("Vous êtes déconnectée.")).toBeVisible();
  await page.goto("/fr/dashboard/client");
  await expect(page).toHaveURL(/\/fr\/auth\/sign-in/);

  // And she can sign back in with her password.
  await signIn(page, email);
  await expect(page).toHaveURL(/\/fr\/dashboard\/client$/);
});

test("a professional gets one account with draft profiles and a pending Botox request", async ({ page }) => {
  const email = `pro-${Date.now()}@test.invalid`;
  await page.goto("/fr/auth/sign-up?role=provider");
  const f = form(page);
  await f.getByLabel("Nom complet").fill("Lina Kaci");
  await f.getByLabel("Nom de l’établissement ou nom professionnel").fill("Salon Lina Test");
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Téléphone").fill("0661 23 45 67");
  await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await f.locator("select[name=wilaya]").selectOption("16");
  await f.getByLabel("En salon").check();
  await f.getByLabel("Ongles").check();
  await f.getByLabel("Botox").check();
  await f.getByRole("checkbox", { name: /J’accepte/ }).check();
  await f.getByRole("button", { name: "Créer mon compte professionnel" }).click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();

  await page.goto("/fr/auth/sign-in");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/fr\/dashboard\/provider$/);
  await expect(page.getByText("Confirmez votre adresse e-mail")).toBeVisible();
  await expect(page.getByText("Salon Lina Test")).toBeVisible();
  await expect(page.locator("main").getByRole("listitem").filter({ hasText: "Ongles" })).toContainText("Brouillon");
  await expect(page.getByText("Catégories en attente de validation")).toBeVisible();
  await page.goto("/fr/dashboard/client");
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
});

test("sign-in errors never reveal whether the email exists", async ({ page }) => {
  await page.goto("/fr/auth/sign-in");
  await signIn(page, "nobody@test.invalid", "Mauvais mot 1");
  await expect(page.locator("main").getByRole("alert")).toHaveText("E-mail ou mot de passe incorrect.");
});

test("the Arabic sign-up page is right-to-left", async ({ page }) => {
  await page.goto("/ar/auth/sign-up?role=provider");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "انضمي إلى Woman Cares" })).toBeVisible();
});

test("a super admin created with the CLI can open the admin area", async ({ page }) => {
  const { execSync } = await import("node:child_process");
  const email = `owner-${Date.now()}@test.invalid`;
  const password = "Bootstrap owner 2026 ok";
  execSync(`npx tsx scripts/create-super-admin.ts --email ${email} --name "Owner Test"`, {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, SUPER_ADMIN_PASSWORD: password },
    stdio: "ignore",
  });
  await page.goto("/fr/auth/sign-in");
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/fr\/dashboard\/admin$/);
  await expect(page.getByRole("heading", { name: "Vue d’ensemble", level: 1 })).toBeVisible();
  await expect(page.getByText("Super administratrice")).toBeVisible();
});

test("after signing up with a Gmail address the page offers a button to Gmail, and none for other addresses", async ({ page }) => {
  const signUp = async (email: string) => {
    await page.goto("/fr/auth/sign-up");
    const f = form(page);
    await f.getByLabel("Nom complet").fill("Amel Test");
    await f.getByLabel("E-mail").fill(email);
    await f.getByLabel("Téléphone").fill("0550 12 34 56");
    await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
    await f.getByRole("checkbox").check();
    await f.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();
  };

  // Each sign-up comes from its own address, as real visitors do (the limit is per address).
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.31.4.7" });
  await signUp(`wc-mailbox-${Date.now()}@gmail.com`);
  const gmail = page.getByRole("link", { name: "Ouvrir Gmail" });
  await expect(gmail).toBeVisible();
  await expect(gmail).toHaveAttribute("href", "https://mail.google.com/");
  await expect(gmail).toHaveAttribute("rel", /noopener/);

  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.31.4.8" });
  await signUp(`wc-mailbox-${Date.now()}@salon-test.invalid`);
  await expect(page.getByRole("link", { name: /^Ouvrir/ })).toHaveCount(0);
});

test("the link confirms on its own in a real browser and opens her space; an automated one leaves the token alone", async ({ page, browser }) => {
  const email = `cliente-auto-${Date.now()}@test.invalid`;
  await page.goto("/fr/auth/sign-up");
  const f = form(page);
  await f.getByLabel("Nom complet").fill("Samia Auto");
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Téléphone").fill("0550 12 34 56");
  await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await f.getByRole("checkbox").check();
  await f.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();
  const link = await linkFromEmail(email, "verify-email");

  // A mail scanner is an automated browser: it must not use up the one-time token.
  const scanner = await browser.newPage();
  await scanner.goto(link);
  await scanner.waitForTimeout(2500);
  await expect(scanner).toHaveURL(/\/auth\/verify-email\?token=/);
  await expect(scanner.getByRole("button", { name: "Confirmer mon adresse" })).toBeVisible();
  await scanner.close();

  // A person's browser submits it by itself and lands in her space, signed in.
  const human = await browser.newContext();
  await human.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
  const tab = await human.newPage();
  await tab.goto(link);
  await expect(tab).toHaveURL(/\/fr\/dashboard\/client$/, { timeout: 15_000 });
  await expect(tab.getByRole("heading", { name: "Bonjour Samia" })).toBeVisible();

  // The same link cannot be used twice.
  await tab.goto(link);
  await tab.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(tab.getByText("Ce lien n’est pas valide ou a déjà été utilisé.")).toBeVisible();
  await human.close();
});

test("the page she signed up on opens her space once she confirms in another browser", async ({ page, browser }) => {
  const email = `cliente-relais-${Date.now()}@test.invalid`;
  await page.goto("/fr/auth/sign-up");
  const f = form(page);
  await f.getByLabel("Nom complet").fill("Rania Relais");
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Téléphone").fill("0550 12 34 56");
  await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await f.getByRole("checkbox").check();
  await f.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();
  await expect(page.getByText("Cette page ouvrira votre espace")).toBeVisible();
  await expect(page.getByRole("link", { name: "Aller à la connexion" })).toHaveCount(0);

  // She opens the link in the mail app's browser: another browser, with no cookies from this one.
  const mailApp = await browser.newContext();
  const tab = await mailApp.newPage();
  await tab.goto(await linkFromEmail(email, "verify-email"));
  await tab.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(tab).toHaveURL(/\/fr\/dashboard\/client$/);
  await mailApp.close();

  // Back in the first browser, the waiting page signs her in and opens her space.
  await expect(page).toHaveURL(/\/fr\/dashboard\/client$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Bonjour Rania" })).toBeVisible();
});
