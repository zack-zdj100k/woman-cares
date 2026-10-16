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

  // Open the link from the email; confirmation is a deliberate POST.
  await page.goto(await linkFromEmail(email, "verify-email"));
  await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(page.getByText("Votre adresse est confirmée")).toBeVisible();
  await page.getByRole("link", { name: "Continuer" }).click();

  await signIn(page, email);
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
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await expect(page.getByText("SUPER_ADMIN")).toBeVisible();
});
