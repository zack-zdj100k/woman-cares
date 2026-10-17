import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { addDays } from "@/lib/availability";
import { formatDate, formatDzd } from "@/lib/format";
import { algiersMidnight } from "@/lib/pricing-dates";
import { cn } from "@/lib/cn";
import { canManageCatalog } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { getPricingOverview } from "@/server/services/admin-pricing";
import { AdminTitle, Chip, ReadOnlyNote, adminPage } from "@/components/admin/admin-ui";
import { ManageForm } from "@/components/admin/manage-form";
import { DecisionFeedback } from "@/components/ui/decision-feedback";
import { fieldClass } from "@/components/ui/field-class";

export async function generateMetadata(): Promise<Metadata> {
  const at = await getAdminDictionary(await getLocale());
  return { title: at.pricing.title, robots: { index: false } };
}

export default function PricingPage({ params }: PageProps<"/[locale]/dashboard/admin/pricing">) {
  return (
    <>
      <Pricing params={params} />
    </>
  );
}

async function Pricing({ params }: { params: PageProps<"/[locale]/dashboard/admin/pricing">["params"] }) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/pricing`);
  let data: Awaited<ReturnType<typeof getPricingOverview>>;
  try {
    data = await getPricingOverview(user);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const at = await getAdminDictionary(locale);
  const p = at.pricing;
  const manage = canManageCatalog(user);
  const labels = { done: at.manage.done, errors: at.manage.errors };
  // Days are Algiers calendar days; noon keeps the formatted date on the same day in any zone.
  const day = (d: string) => formatDate(new Date(algiersMidnight(d).getTime() + 12 * 3_600_000), locale, { dateStyle: "long" });
  const tomorrow = addDays(data.today, 1);
  const stateTone = { current: "ink", upcoming: "rose", past: "quiet", replaced: "quiet" } as const;

  return (
    <div className={adminPage}>
      <AdminTitle title={p.title} intro={p.intro} />
      {!manage && <ReadOnlyNote>{at.manage.readOnly}</ReadOnlyNote>}

      <DecisionFeedback>
        <div className="mt-8 grid gap-6">
          {data.categories.map((c) => {
            const name = locale === "ar" ? c.nameAr : c.nameFr;
            return (
              <section key={c.id} aria-labelledby={`price-${c.slug}`} className="card-soft rounded-[28px] p-5 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 id={`price-${c.slug}`} className="type-display text-[clamp(1.7rem,2.6vw,2.2rem)]">
                      {name}
                    </h2>
                    {!c.active && (
                      <p className="mt-1">
                        <Chip tone="rose">{p.inactive}</Chip>
                      </p>
                    )}
                  </div>
                  <div className="text-end">
                    <p className="text-sm text-ink-2">{p.current}</p>
                    {c.current ? (
                      <>
                        <p className="type-display text-4xl tabular-nums">
                          {formatDzd(c.current.monthlyPrice, locale)} <span className="font-sans text-sm text-ink-2">{p.perMonth}</span>
                        </p>
                        <p className="text-sm text-ink-2">{p.since(day(c.current.day))}</p>
                      </>
                    ) : (
                      <p className="font-medium">{p.none}</p>
                    )}
                  </div>
                </div>
                {c.next && (
                  <p className="mt-4 rounded-(--radius-field) bg-rose/8 px-4 py-3 text-sm text-rose-ink">{p.next(day(c.next.day), formatDzd(c.next.monthlyPrice, locale))}</p>
                )}

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <div className="min-w-0">
                    <h3 className="mb-2 text-sm font-medium">{p.history}</h3>
                    {c.rows.length === 0 ? (
                      <p className="text-sm text-ink-2">{p.noHistory}</p>
                    ) : (
                      <table className="w-full text-start text-sm">
                        <thead className="text-ink-2">
                          <tr className="border-b border-line">
                            <th scope="col" className="py-2 pe-3 text-start font-normal">{p.columns.day}</th>
                            <th scope="col" className="py-2 pe-3 text-start font-normal">{p.columns.price}</th>
                            <th scope="col" className="py-2 pe-3 text-start font-normal">{p.columns.state}</th>
                            <th scope="col" className="hidden py-2 text-start font-normal sm:table-cell">{p.columns.by}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {c.rows.map((r) => (
                            <tr key={r.id} className={cn(r.state === "replaced" && "text-ink-2")}>
                              <td className="py-2.5 pe-3">{day(r.day)}</td>
                              <td className={cn("py-2.5 pe-3 tabular-nums", r.state === "replaced" && "line-through")}>{formatDzd(r.monthlyPrice, locale)}</td>
                              <td className="py-2.5 pe-3">
                                <Chip tone={stateTone[r.state]}>{p.states[r.state]}</Chip>
                              </td>
                              <td className="hidden py-2.5 text-ink-2 sm:table-cell">
                                {r.createdBy ?? p.seed} · {formatDate(r.createdAt, locale, { dateStyle: "medium" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {manage && (
                    <div className="rounded-[22px] bg-surface p-5">
                      <h3 className="text-sm font-medium">{p.schedule}</h3>
                      <ManageForm
                        op="price.add"
                        id={c.id}
                        label={p.submit}
                        labels={labels}
                        tone="solid"
                        className="mt-3"
                        fields={
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            <label className="grid gap-1.5 text-sm font-medium">
                              {p.price}
                              <input name="price" required inputMode="numeric" pattern="[0-9 ]{1,9}" autoComplete="off" className={cn(fieldClass, "border-ink/20 font-normal")} dir="ltr" />
                            </label>
                            <label className="grid gap-1.5 text-sm font-medium">
                              {p.day}
                              <input name="day" type="date" required min={tomorrow} defaultValue={tomorrow} className={cn(fieldClass, "border-ink/20 font-normal")} dir="ltr" />
                            </label>
                          </div>
                        }
                      />
                      {c.next && <p className="mt-3 text-xs leading-relaxed text-ink-2">{p.replaceHint}</p>}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </DecisionFeedback>
    </div>
  );
}
