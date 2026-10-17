import type { Metadata } from "next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { canDelete, canManageCatalog } from "@/server/policies/roles";
import { notFound } from "next/navigation";
import { ForbiddenError } from "@/server/services/admin-users";
import { listAdminCategories } from "@/server/services/admin-categories";
import { AdminTitle, Chip, ReadOnlyNote, adminPage } from "@/components/admin/admin-ui";
import { ManageForm } from "@/components/admin/manage-form";
import { DecisionFeedback } from "@/components/ui/decision-feedback";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const at = await getAdminDictionary(await getLocale());
  return { title: at.categories.title, robots: { index: false } };
}

export default function CategoriesPage({ params }: PageProps<"/[locale]/dashboard/admin/categories">) {
  return (
    <>
      <Categories params={params} />
    </>
  );
}

async function Categories({ params }: { params: PageProps<"/[locale]/dashboard/admin/categories">["params"] }) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/categories`);
  let categories: Awaited<ReturnType<typeof listAdminCategories>>;
  try {
    categories = await listAdminCategories(user);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const at = await getAdminDictionary(locale);
  const c = at.categories;
  const manage = canManageCatalog(user);
  const labels = { done: at.manage.done, errors: at.manage.errors };

  return (
    <div className={adminPage}>
      <AdminTitle title={c.title} intro={c.intro} />
      {!manage && <ReadOnlyNote>{at.manage.readOnly}</ReadOnlyNote>}

      <DecisionFeedback>
        <ol className="mt-8 grid gap-4">
          {categories.map((cat, i) => {
            const name = locale === "ar" ? cat.nameAr : cat.nameFr;
            return (
              <li key={cat.id} className="card-soft grid gap-5 rounded-[28px] p-5 sm:p-7 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                <div className="flex items-center gap-3 md:flex-col md:gap-1">
                  <span className="type-display grid size-12 place-items-center rounded-full bg-surface text-2xl tabular-nums" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="sr-only">{c.position(i + 1)}</span>
                  {manage && (
                    <div className="flex gap-1 md:flex-col">
                      {i > 0 && (
                        <ManageForm op="category.up" id={cat.id} label={c.up(name)} ariaLabel={c.up(name)} labels={labels}>
                          <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden="true" />
                        </ManageForm>
                      )}
                      {i < categories.length - 1 && (
                        <ManageForm op="category.down" id={cat.id} label={c.down(name)} ariaLabel={c.down(name)} labels={labels}>
                          <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
                        </ManageForm>
                      )}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="type-display text-[clamp(1.7rem,2.6vw,2.2rem)]">{name}</h2>
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <Chip tone={cat.active ? "ink" : "rose"}>{cat.active ? c.active : c.inactive}</Chip>
                    {cat.requiresCredentialReview && <Chip>{c.credentials}</Chip>}
                    <span className="text-sm text-ink-2">
                      <bdi dir="ltr">/{cat.slug}</bdi> · {c.published(cat.published)} · {c.total(cat._count.profiles)}
                    </span>
                  </p>
                </div>

                {manage && (
                  <div className="flex flex-wrap items-start gap-3 md:justify-end">
                    {cat.active ? (
                      <ManageForm op="category.deactivate" id={cat.id} label={c.deactivate} labels={labels} tone="danger" confirm={c.deactivateConfirm(cat.published)} />
                    ) : (
                      <ManageForm op="category.activate" id={cat.id} label={c.activate} labels={labels} tone="solid" />
                    )}
                    {canDelete(user) && <ManageForm op="category.delete" id={cat.id} label={at.deletes.category} labels={labels} tone="danger" confirm={at.deletes.categoryConfirm} />}
                    {cat.requiresCredentialReview ? (
                      <ManageForm op="category.credentials.waive" id={cat.id} label={c.waive} labels={labels} confirm={c.waiveConfirm} />
                    ) : (
                      <ManageForm op="category.credentials.require" id={cat.id} label={c.require} labels={labels} confirm={c.requireConfirm} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </DecisionFeedback>
    </div>
  );
}
