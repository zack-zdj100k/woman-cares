import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminDictionary, getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { canDelete } from "@/server/policies/roles";
import { getTargets, HIGHER_IS_BETTER, TARGET_KEYS } from "@/server/services/targets";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { TargetsForm } from "@/components/admin/targets-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const at = await getAdminDictionary(await getLocale());
  return { title: at.settings.title, robots: { index: false } };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/admin/settings">) {
  return <Settings params={params} />;
}

async function Settings({ params }: { params: PageProps<"/[locale]/dashboard/admin/settings">["params"] }) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/settings`);
  if (!canDelete(user)) notFound();
  const [at, d, targets] = await Promise.all([getAdminDictionary(locale), getDashboardDictionary(locale), getTargets()]);
  const s = at.settings;
  return (
    <div className={pageClass}>
      <PageHeader title={s.title} description={s.intro} />
      <Card>
        <CardHeader>
          <CardTitle>{s.targets}</CardTitle>
          <CardDescription>{s.targetsHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <TargetsForm
            rows={TARGET_KEYS.map((k) => ({
              key: k,
              label: d.analytics.rates[k],
              hint: d.analytics.ratesHint[k],
              value: targets[k] === null ? "" : String(Math.round(targets[k]! * 10_000) / 100),
              higher: HIGHER_IS_BETTER[k],
            }))}
            labels={{ min: s.min, max: s.max, save: s.save, saved: s.saved, errors: s.errors }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
