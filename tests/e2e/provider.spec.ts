import { expect, test, type Page } from "@playwright/test";
import { linkFromEmail } from "./db";

const PASSWORD = "Jasmin et rose 7";
const form = (page: Page) => page.locator("main form").filter({ visible: true }).first();

/** Signs up a professional offering nails, confirms the email and signs in. */
async function newVerifiedProvider(page: Page, email: string, business: string) {
  await page.goto("/fr/auth/sign-up?role=provider");
  const f = form(page);
  await f.getByLabel("Nom complet").fill("Lina Kaci");
  await f.getByLabel("Nom de l’établissement ou nom professionnel").fill(business);
  await f.getByLabel("E-mail").fill(email);
  await f.getByLabel("Téléphone").fill("0661 23 45 67");
  await f.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await f.locator("select[name=wilaya]").selectOption("16");
  await f.getByLabel("En salon").check();
  await f.getByLabel("Ongles").check();
  await f.getByRole("checkbox", { name: /J’accepte/ }).check();
  await f.getByRole("button", { name: "Créer mon compte professionnel" }).click();
  await expect(page.getByRole("heading", { name: "Vérifiez votre boîte mail" })).toBeVisible();
  await page.goto(await linkFromEmail(email, "verify-email"));
  await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
  await expect(page.getByText("Votre adresse est confirmée")).toBeVisible();
  await page.goto("/fr/auth/sign-in");
  const s = form(page);
  await s.getByLabel("E-mail").fill(email);
  await s.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await s.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/dashboard\/provider$/);
}

test("a professional completes a profile and sends it for review", async ({ page }) => {
  await newVerifiedProvider(page, `editor-${Date.now()}@test.invalid`, "Atelier Editeur");
  await page.getByRole("link", { name: "Mes profils" }).first().click();
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(page.getByRole("heading", { name: "Ongles", level: 1 })).toBeVisible();

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
