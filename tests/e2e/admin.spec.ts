import { expect, test } from "@playwright/test";
import { PASSWORD, form, newSuperAdmin, newVerifiedClient } from "./flows";

test("a CLI-created Super Admin schedules a category price and finds it in the history and the audit log", async ({ page }) => {
  await newSuperAdmin(page);
  await page.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Tarifs" }).click();
  await expect(page.getByRole("heading", { name: "Tarifs", level: 1 })).toBeVisible();

  const nails = page.getByRole("region", { name: "Ongles" });
  await nails.getByLabel("Prix mensuel (DA)").fill("41250");
  // Tomorrow (Algiers), so the new price is scheduled rather than in force at once.
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date(Date.now() + 86_400_000));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date());
  await nails.locator("button[aria-haspopup=dialog]").click();
  const calendar = page.getByRole("dialog");
  if (Number(tomorrow.slice(8)) < Number(today.slice(8))) await calendar.getByRole("button", { name: "›" }).click(); // tomorrow is next month
  await calendar.getByRole("button", { name: String(Number(tomorrow.slice(8))), exact: true }).click();
  await nails.getByRole("button", { name: "Programmer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Modification enregistrée." })).toBeVisible();

  const row = nails.getByRole("row").filter({ hasText: /41\s250\sDA/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("À venir")).toBeVisible();
  await expect(nails.getByText(/À partir du .* : 41\s250\sDA/)).toBeVisible();

  // A date before 2020 is refused by the server, whatever the browser allows.
  await nails.getByLabel("Prix mensuel (DA)").fill("39000");
  await nails.locator("input[name=day]").evaluate((el: HTMLInputElement) => {
    el.value = "2019-01-01";
  });
  await nails.getByRole("button", { name: "Programmer" }).click();
  await expect(nails.getByRole("alert")).toHaveText("Choisissez une date valide (à partir de 2020, deux ans à l’avance au plus).");
  await expect(nails.getByRole("row").filter({ hasText: /39\s000\sDA/ })).toHaveCount(0);

  await page.getByRole("link", { name: "Journal" }).click();
  await page.getByLabel("Action").selectOption({ label: "Nouveau tarif programmé" });
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/action=subscription\.price\.schedule/);
  await expect(page.getByText(/Catégorie : Ongles · Prix mensuel : 41250/)).toBeVisible();
});

test("clients get the not-found page on every new admin area", async ({ page }) => {
  const email = `admin-404-${Date.now()}@test.invalid`;
  await newVerifiedClient(page, email);
  await page.goto("/fr/auth/sign-in");
  const f = form(page);
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await f.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard\/client$/);
  for (const path of ["users", "categories", "pricing", "audit-logs", "subscriptions", "payments", "invoices"]) {
    await page.goto(`/fr/dashboard/admin/${path}`);
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  }
});
